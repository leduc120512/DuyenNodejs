from flask import Flask, jsonify
from pymongo import MongoClient
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from bson import ObjectId

app = Flask(__name__)

client = MongoClient("mongodb://localhost:27017/")
db = client["fan-shop"]


@app.route("/recommend/<user_id>")
def recommend(user_id):

    # ===============================
    # 1️⃣ LẤY 8 SẢN PHẨM MỚI NHẤT
    # ===============================
    latest_products = list(
        db.products.find().sort("createdAt", -1).limit(8)
    )

    latest_ids = [p["_id"] for p in latest_products]

    # ===============================
    # 2️⃣ LẤY LỊCH SỬ USER
    # ===============================
    histories = list(db.userhistories.find({
        "user": ObjectId(user_id),
        "action": {"$in": ["view", "purchase"]}
    }))

    # Nếu chưa có hành vi → trả luôn 8 sản phẩm mới nhất
    if not histories:
        return jsonify(serialize(latest_products))

    interacted_ids = [h["product"] for h in histories if "product" in h]

    # ===============================
    # 3️⃣ LẤY TOÀN BỘ SẢN PHẨM
    # ===============================
    products = list(db.products.find())

    if not products:
        return jsonify(serialize(latest_products))

    product_ids = [p["_id"] for p in products]

    # ===============================
    # 4️⃣ TẠO TEXT CHO AI
    # ===============================
    descriptions = []

    for p in products:
        text = ""
        text += p.get("name", "") + " "
        text += p.get("description", "") + " "
        if "tags" in p:
            text += " ".join(p["tags"])
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

    recommended_products = []

    # ===============================
    # 5️⃣ CHỈ LẤY SẢN PHẨM NẰM TRONG 8 MỚI NHẤT
    # ===============================
    for i in recommended_indices:
        if product_ids[i] not in interacted_ids and product_ids[i] in latest_ids:
            recommended_products.append(products[i])

        if len(recommended_products) >= 8:
            break

    # ===============================
    # 6️⃣ ĐẢM BẢO TỐI THIỂU 4 SẢN PHẨM
    # ===============================
    if len(recommended_products) < 4:
        for p in latest_products:
            if p["_id"] not in [r["_id"] for r in recommended_products]:
                recommended_products.append(p)

            if len(recommended_products) >= 4:
                break

    return jsonify(serialize(recommended_products))


def serialize(products):
    for p in products:
        p["_id"] = str(p["_id"])
        if "category" in p:
            p["category"] = str(p["category"])
    return products


if __name__ == "__main__":
    app.run(port=5000)