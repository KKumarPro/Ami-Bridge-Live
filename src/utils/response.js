"use strict";

const ok = (res, data, status = 200) => res.status(status).json(data);

const created = (res, data) => res.status(201).json(data);

const badRequest = (res, message) =>
  res.status(400).json({ error: message });

const unauthorized = (res, message = "Unauthorized") =>
  res.status(401).json({ error: message });

const forbidden = (res, message = "Forbidden") =>
  res.status(403).json({ error: message });

const notFound = (res, message = "Not found") =>
  res.status(404).json({ error: message });

const serverError = (res, message = "Internal server error") =>
  res.status(500).json({ error: message });

module.exports = { ok, created, badRequest, unauthorized, forbidden, notFound, serverError };
