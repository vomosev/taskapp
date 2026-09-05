function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const candidateStatus = Number(err && (err.statusCode || err.status));
  const statusCode =
    Number.isInteger(candidateStatus) &&
    candidateStatus >= 400 &&
    candidateStatus <= 599
      ? candidateStatus
      : 500;

  if (statusCode >= 500) {
    console.error("Unexpected server error:", {
      method: req.method,
      path: req.originalUrl,
      message: err && err.message ? err.message : "Unknown error",
      stack: err && err.stack ? err.stack : undefined,
    });
  }

  const error = {
    message:
      statusCode === 500
        ? "Internal server error"
        : err && err.message
          ? err.message
          : "Request failed",
  };

  if (err && err.details !== undefined && statusCode < 500) {
    error.details = err.details;
  }

  return res.status(statusCode).json({ error });
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;