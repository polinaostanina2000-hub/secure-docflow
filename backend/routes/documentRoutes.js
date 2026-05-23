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
    createCorrection
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
    "/correction/:id",
    authMiddleware,
    upload.any(),
    createCorrection
);

module.exports = router;