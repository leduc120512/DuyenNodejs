const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next()
  }
  res.redirect("/auth/login")
}

const isAdmin = (req, res, next) => {
  if (req.session && req.session.userId && req.session.userRole === "admin") {
    return next()
  }
  res.redirect("/auth/login")
}

const isUser = (req, res, next) => {
  if (req.session && req.session.userId && req.session.userRole === "user") {
    return next()
  }
  res.redirect("/auth/login")
}

module.exports = { isAuthenticated, isAdmin, isUser }
