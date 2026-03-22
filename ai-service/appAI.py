from flask import Flask, jsonify
from pymongo import MongoClient
from bson import ObjectId
import numpy as np
import pandas as pd
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import joblib
import os

app = Flask(__name__)

# ==========================
# CONNECT DB
# ==========================
client = MongoClient("mongodb://localhost:27017/")
db = client["fan-shop"]

MODEL_PATH = "model.pkl"


# ==========================
# TRAIN COLLAB MODEL (SVD)
# ==========================
def train_model():
    histories = list(db.userhistories.find({
        "action": {"$in": ["view", "purchase"]}
    }))

    if not histories:
        print("No data to train")
        return

    data = []
    for h in histories:
        user = str(h["user"])
        product = str(h["product"])
        score = 3 if h["action"] == "purchase" else 1
        data.append([user, product, score])

    df = pd.DataFrame(data, columns=["user", "product", "score"])

    matrix = df.pivot_table(
        index="user",
        columns="product",
        values="score",
        fill_value=0
    )

    svd = TruncatedSVD(n_components=5)
    latent = svd.fit_transform(matrix)

    joblib.dump({
        "matrix": matrix,
        "latent": latent
    }, MODEL_PATH)

    print("Train done")


def load_model():
    if not os.path.exists(MODEL_PATH):
        train_model()
    return joblib.load(MODEL_PATH)


# ==========================
# CONTENT-BASED (REALTIME)
# ==========================
def get_content_recommend(user_id):

    latest_products = list(
        db.products.find().sort("createdAt", -1).limit(8)
    )

    histories = list(db.userhistories.find({
        "user": ObjectId(user_id),
        "action": {"$in": ["view", "purchase"]}
    }))

    # user mới → trả latest
    if not histories:
        return latest_products

    interacted_ids = [h["product"] for h in histories if "product" in h]

    products = list(db.products.find())
    product_ids = [p["_id"] for p in products]

    if not products:
        return latest_products

    descriptions = []
    for p in products:
        text = p.get("name", "") + " " + p.get("description", "")
        if "tags" in p:
            text += " " + " ".join(p["tags"])
        descriptions.append(text)

    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(descriptions)
    similarity_matrix = cosine_similarity(tfidf_matrix)

    scores = np.zeros(len(products))

    for pid in interacted_ids:
        if pid in product_ids:
            index = product_ids.index(pid)
            scores += similarity_matrix[index]

    recommended_indices = scores.argsort()[::-1]

    result = []
    for i in recommended_indices:
        if product_ids[i] not in interacted_ids:
            result.append(products[i])
        if len(result) >= 8:
            break

    return result


# ==========================
# COLLABORATIVE (SVD)
# ==========================
def get_collab_recommend(user_id):

    if not os.path.exists(MODEL_PATH):
        train_model()

    data = load_model()
    matrix = data["matrix"]
    latent = data["latent"]

    if user_id not in matrix.index:
        return []

    user_index = list(matrix.index).index(user_id)
    user_vector = latent[user_index]

    similarity = latent @ user_vector
    similar_users = similarity.argsort()[::-1][1:6]

    recommended_ids = set()

    for idx in similar_users:
        liked = matrix.iloc[idx]
        liked_products = liked[liked > 0].index
        recommended_ids.update(liked_products)

    already = matrix.loc[user_id]
    already_ids = already[already > 0].index

    final_ids = list(recommended_ids - set(already_ids))

    if not final_ids:
        return []

    products = list(db.products.find({
        "_id": {"$in": [ObjectId(pid) for pid in final_ids]}
    }).limit(8))

    return products


# ==========================
# HYBRID RECOMMEND (CHÍNH)
# ==========================
@app.route("/recommend/<user_id>")
def hybrid_recommend(user_id):

    content = get_content_recommend(user_id)
    collab = get_collab_recommend(user_id)

    result = []
    used_ids = set()

    # 1. ƯU TIÊN COLLAB
    for p in collab:
        if p["_id"] not in used_ids:
            result.append(p)
            used_ids.add(p["_id"])
        if len(result) >= 8:
            return jsonify(serialize(result[:8]))

    # 2. THÊM CONTENT
    for p in content:
        if p["_id"] not in used_ids:
            result.append(p)
            used_ids.add(p["_id"])
        if len(result) >= 8:
            return jsonify(serialize(result[:8]))

    # 3. FALLBACK: LATEST
    latest = list(db.products.find().sort("createdAt", -1).limit(8))

    for p in latest:
        if p["_id"] not in used_ids:
            result.append(p)
            used_ids.add(p["_id"])
        if len(result) >= 8:
            break

    # 4. ĐẢM BẢO TỐI THIỂU 4
    if len(result) < 4:
        extra = list(db.products.find().limit(10))
        for p in extra:
            if p["_id"] not in used_ids:
                result.append(p)
                used_ids.add(p["_id"])
            if len(result) >= 4:
                break

    return jsonify(serialize(result[:8]))


# ==========================
# TRAIN API
# ==========================
@app.route("/train")
def train():
    train_model()
    return jsonify({"message": "trained"})


# ==========================
# SERIALIZE
# ==========================
def serialize(products):
    for p in products:
        p["_id"] = str(p["_id"])
        if "category" in p:
            p["category"] = str(p["category"])
    return products


# ==========================
# RUN SERVER
# ==========================
if __name__ == "__main__":
    app.run(port=5000)