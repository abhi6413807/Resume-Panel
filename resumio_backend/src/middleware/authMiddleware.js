const jwt = require("jsonwebtoken");
const Candidate = require("../models/Candidate");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: token missing" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Restrict access based on path and role
    const isInterviewsRoute = req.originalUrl.startsWith("/api/interviews") || req.originalUrl.includes("/interviews");
    const isCandidatesRoute = req.originalUrl.startsWith("/api/candidates") && !isInterviewsRoute;
    const isDocumentsRoute = req.originalUrl.startsWith("/api/documents");

    const isAdmin = !!decoded.adminId;
    const isManager = !!decoded.managerId;
    const isOperator = decoded.role && decoded.role.toUpperCase() === "DATA_ENTRY_OPERATOR";

    if (isCandidatesRoute) {
      const isCreateOrUpdateOrCreateFromDocument = req.method === "POST" || req.method === "PUT" || req.method === "DELETE";
      if (isCreateOrUpdateOrCreateFromDocument) {
        if (req.method === "DELETE") {
          if (!isAdmin) {
            if (isOperator) {
              try {
                const candidateId = req.params.id || req.originalUrl.split("/").pop().split("?")[0];
                const candidate = await Candidate.findById(candidateId);
                if (!candidate || !candidate.createdByOperator) {
                  return res.status(403).json({ message: "Forbidden: Operator can only delete profiles created by Data Entry Operator" });
                }
              } catch (dbErr) {
                return res.status(500).json({ message: "Database lookup failed", error: dbErr.message });
              }
            } else {
              return res.status(403).json({ message: "Forbidden: Only Admin or Operator can delete candidates" });
            }
          }
        } else {
          const isSendToManagerRoute = req.originalUrl.includes("/send-to-manager");
          if (isSendToManagerRoute) {
            if (!isAdmin) {
              return res.status(403).json({ message: "Forbidden: Only Admin can send profiles to manager" });
            }
          } else {
            if (!isOperator) {
              return res.status(403).json({ message: "Forbidden: Only Data Entry Operator can create or modify candidate data" });
            }
          }
        }
      }
      return next();
    }

    if (isDocumentsRoute) {
      if (!isOperator) {
        return res.status(403).json({ message: "Forbidden: Only Data Entry Operator can import or parse documents" });
      }
      return next();
    }

    if (isInterviewsRoute) {
      const isWriteRoute = req.method === "POST" || req.method === "PUT" || req.method === "DELETE" || req.method === "PATCH";
      if (isWriteRoute && isAdmin) {
        return res.status(403).json({ message: "Forbidden: Admin cannot schedule or manage interviews" });
      }
      if (!isAdmin && !isManager) {
        return res.status(403).json({ message: "Forbidden: Data Entry Operator cannot manage interviews" });
      }
      return next();
    }

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
}

module.exports = { authMiddleware };
