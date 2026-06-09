const express = require("express");
const router = express.Router();

const multer = require("multer");
const authMiddleware = require("../middleware/authMiddleware");

const {
    uploadDocument,
    getDocuments,
    deleteDocument,
    downloadDocument,
    verifyDocument,
    signDocument,
    checkSignature,
    viewStampedDocument,
    cancelDocument,
    markDocumentViewed,
    getNotifications,
    markNotificationsRead
} = require("../controllers/documentController");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },

    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

router.post(
    "/upload",
    authMiddleware,
    upload.any(),
    uploadDocument
);

router.get(
    "/",
    authMiddleware,
    getDocuments
);

router.delete(
    "/:id",
    authMiddleware,
    deleteDocument
);

router.get(
    "/download/:id",
    authMiddleware,
    downloadDocument
);

router.get(
    "/verify/:id",
    authMiddleware,
    verifyDocument
);

router.post(
    "/sign/:id",
    authMiddleware,
    signDocument
);

router.get(
    "/check-sign/:id",
    authMiddleware,
    checkSignature
);

router.get(
    "/stamped/:id",
    authMiddleware,
    viewStampedDocument
);

router.post(
    "/cancel/:id",
    authMiddleware,
    cancelDocument
);

router.post(
    "/view/:id",
    authMiddleware,
    markDocumentViewed
);

router.get(
    "/notifications",
    authMiddleware,
    getNotifications
);

router.post(
    "/notifications/read",
    authMiddleware,
    markNotificationsRead
);

module.exports = router;