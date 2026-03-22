# Fan Shop E-commerce Website

A full-stack e-commerce website for selling fans, built with Node.js, Express, EJS, and MongoDB.

## Features

### Admin Features
- Dashboard with statistics
- Product management (CRUD with image upload)
- Category management (CRUD)
- Order management with status updates
- Search functionality for products, categories, and orders

### User Features
- User registration and login
- Browse products with search and filter by category
- View top 3 best-selling products
- Add products to cart (session-based)
- Checkout and place orders
- View order history with search
- Cancel pending orders
- Update profile information
- Change password

## Installation

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Create a `.env` file with your configuration:
\`\`\`
MONGODB_URI=mongodb://localhost:27017/fan-shop
SESSION_SECRET=your-secret-key-here
PORT=3000
\`\`\`

3. Make sure MongoDB is running on your system

4. Start the application:
\`\`\`bash
npm start
\`\`\`

For development with auto-reload:
\`\`\`bash
npm run dev
\`\`\`

5. Access the application at `http://localhost:3000`

## Default Admin Account

To create an admin account, you need to manually insert a user with role 'admin' in MongoDB, or register a user and change their role to 'admin' in the database.

## Project Structure

\`\`\`
fan-shop/
├── config/          # Database configuration
├── models/          # Mongoose models
├── routes/          # Express routes
├── views/           # EJS templates
├── middleware/      # Custom middleware
├── public/          # Static files (CSS, images, uploads)
├── app.js           # Main application file
└── package.json     # Dependencies
\`\`\`

## Technologies Used

- Node.js
- Express.js
- EJS (Embedded JavaScript templates)
- MongoDB with Mongoose
- Express Session
- Multer (file upload)
- Bcrypt.js (password hashing)
