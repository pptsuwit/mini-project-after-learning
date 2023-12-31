const express = require("express");
const router = express.Router();
const Joi = require("joi");
const validateRequest = require("../_middleware/validate-request");
const authorize = require("../_middleware/authorize");
const service = require("../services/auth.service");

// routes
router.post("/refresh-token", refreshToken);
router.post("/revoke-token", authorize(), revokeTokenSchema, revokeToken);
router.get("/:id/refresh-tokens", authorize(), getRefreshTokens);

router.post("/login", loginSchema, login);
router.post("/register", registerSchema, register);

module.exports = router;

function registerSchema(req, res, next) {
  const schema = Joi.object({
    firstname: Joi.string().required(),
    lastname: Joi.string().required(),
    username: Joi.string().required(),
    password: Joi.string().required(),
  });
  validateRequest(req, next, schema);
}

function loginSchema(req, res, next) {
  const schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  });
  validateRequest(req, next, schema);
}

function login(req, res, next) {
  const { username, password } = req.body;
  const ipAddress = req.ip;
  service
    .login({ username, password, ipAddress })
    .then(({ refreshToken, ...user }) => {
      setTokenCookie(res, refreshToken);
      res.json(user);
    })
    .catch(next);
}

function register(req, res, next) {
  const { firstname, lastname, username, password } = req.body;
  service
    .register({ firstname, lastname, username, password })
    .then((user) => {
      res.json(user);
    })
    .catch(next);
}

function refreshToken(req, res, next) {
  const token = req.cookies.refreshToken;
  const ipAddress = req.ip;
  service
    .refreshToken({ token, ipAddress })
    .then(({ refreshToken, ...user }) => {
      setTokenCookie(res, refreshToken);
      res.json(user);
    })
    .catch(next);
}

function revokeTokenSchema(req, res, next) {
  const schema = Joi.object({
    token: Joi.string().empty(""),
  });
  validateRequest(req, next, schema);
}

function revokeToken(req, res, next) {
  // accept token from request body or cookie
  const token = req.body.token || req.cookies.refreshToken;
  const ipAddress = req.ip;

  if (!token) return res.status(400).json({ message: "Token is required" });

  // users can revoke their own tokens and admins can revoke any tokens
  if (!req.user.ownsToken(token)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  service
    .revokeToken({ token, ipAddress })
    .then(() => res.json({ message: "Token revoked" }))
    .catch(next);
}

function getRefreshTokens(req, res, next) {
  // users can get their own refresh tokens and admins can get any user's refresh tokens
  if (req.params.id !== req.user.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  service
    .getRefreshTokens(req.params.id)
    .then((tokens) => (tokens ? res.json(tokens) : res.sendStatus(404)))
    .catch(next);
}

function setTokenCookie(res, token) {
  // create http only cookie with refresh token that expires in 7 days
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  res.cookie("refreshToken", token, cookieOptions);
}
