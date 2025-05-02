module.exports = {
  ensureAuthenticated: (req, res, next) => {
    if (req.isAuthenticated()) {
      return next()
    }
    req.flash("error_msg", "Please log in to view this resource")
    res.redirect("/login")
  },

  ensureAdmin: (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === "admin") {
      return next()
    }
    req.flash("error_msg", "You need admin privileges to access this resource")
    res.redirect("/dashboard")
  },

  ensureSubAdmin: (req, res, next) => {
    if (req.isAuthenticated() && (req.user.role === "admin" || req.user.role === "subadmin")) {
      return next()
    }
    req.flash("error_msg", "You need admin or subadmin privileges to access this resource")
    res.redirect("/dashboard")
  },
}
