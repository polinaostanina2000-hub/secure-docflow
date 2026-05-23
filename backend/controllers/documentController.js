const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const CryptoJS = require("crypto-js");
const db = require("../config/db");

const getOriginalFileName = (fileName) => {
    try {
        return Buffer.from(fileName, "latin1").toString("utf8");
    } catch {
        return fileName;
    }
};

const parseRecipients = (recipients) => {
    if (!recipients) return [];

    try {
        const parsed = JSON.parse(recipients);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const checkDocumentAccess = async (documentId, userId, role, uploadedBy) => {
    if (role === "admin") return true;
    if (uploadedBy === userId) return true;

    const [recipients] = await db.query(
        `
        SELECT id 
        FROM document_recipients 
        WHERE document_id = ? AND user_id = ?
        `,
        [documentId, userId]
    );

    return recipients.length > 0;
};

const uploadDocument = async (req, res) => {
    try {
        const file = req.files && req.files[0];

        if (!file) {
            return res.status(400).json({
                message: "Файл не загружен"
            });
        }

        const { title, recipients } = req.body;

        if (!title) {
            return res.status(400).json({
                message: "Введите название документа"
            });
        }

        const recipientIds = parseRecipients(recipients);

        const filePath = path.join(__dirname, "../uploads", file.filename);
        const fileBuffer = fs.readFileSync(filePath);

        const fileHash = crypto
            .createHash("sha256")
            .update(fileBuffer)
            .digest("hex");

        const encryptedData = CryptoJS.AES.encrypt(
            fileBuffer.toString("base64"),
            process.env.AES_SECRET_KEY
        ).toString();

        fs.writeFileSync(filePath, encryptedData);

        const originalFileName = getOriginalFileName(file.originalname);

        const [insertResult] = await db.query(
            `
            INSERT INTO documents
            (title, file_name, encrypted_file_name, file_hash, uploaded_by, status)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                title,
                originalFileName,
                file.filename,
                fileHash,
                req.user.id,
                "В работе"
            ]
        );

        const documentId = insertResult.insertId;

        for (const recipientId of recipientIds) {
            await db.query(
                `
                INSERT INTO document_recipients (document_id, user_id)
                VALUES (?, ?)
                `,
                [documentId, recipientId]
            );
        }

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [
                req.user.id,
                `Загрузка и шифрование документа: ${title}`
            ]
        );

        res.status(201).json({
            message: "Документ успешно загружен и зашифрован",
            documentId,
            fileHash
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка загрузки документа",
            error: error.message
        });
    }
};

const getDocuments = async (req, res) => {
    try {
        let query = `
            SELECT 
                documents.id,
                documents.title,
                documents.file_name,
                documents.encrypted_file_name,
                documents.file_hash,
                documents.signature_hash,
                documents.signed_at,
                documents.created_at,
                documents.uploaded_by,
                documents.signed_by,
                documents.correction_of,
                documents.status,
                authors.full_name AS full_name,
                signers.full_name AS signed_user_name,
                GROUP_CONCAT(recipients.full_name SEPARATOR ', ') AS recipients_names
            FROM documents
            LEFT JOIN users AS authors
                ON documents.uploaded_by = authors.id
            LEFT JOIN users AS signers
                ON documents.signed_by = signers.id
            LEFT JOIN document_recipients
                ON documents.id = document_recipients.document_id
            LEFT JOIN users AS recipients
                ON document_recipients.user_id = recipients.id
        `;

        let params = [];

        if (req.user.role !== "admin") {
            query += `
                WHERE documents.uploaded_by = ?
                OR documents.id IN (
                    SELECT document_id
                    FROM document_recipients
                    WHERE user_id = ?
                )
            `;

            params = [req.user.id, req.user.id];
        }

        query += `
            GROUP BY documents.id
            ORDER BY documents.created_at DESC
        `;

        const [documents] = await db.query(query, params);

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [req.user.id, "Просмотр списка документов"]
        );

        res.json(documents);

    } catch (error) {
        res.status(500).json({
            message: "Ошибка получения документов",
            error: error.message
        });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const documentId = req.params.id;

        const [documents] = await db.query(
            "SELECT * FROM documents WHERE id = ?",
            [documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const document = documents[0];

        if (document.signature_hash) {
            return res.status(403).json({
                message: "Документ подписан ЭЦП и не может быть удалён. Для внесения изменений необходимо создать исправление отдельным документом."
            });
        }

        const hasAccess = await checkDocumentAccess(
            documentId,
            req.user.id,
            req.user.role,
            document.uploaded_by
        );

        if (!hasAccess) {
            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [req.user.id, `Попытка удаления чужого документа: ${document.title}`]
            );

            return res.status(403).json({
                message: "Недостаточно прав для удаления документа"
            });
        }

        const filePath = path.join(
            __dirname,
            "../uploads",
            document.encrypted_file_name
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        await db.query(
            "DELETE FROM documents WHERE id = ?",
            [documentId]
        );

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [req.user.id, `Удаление документа: ${document.title}`]
        );

        res.json({
            message: "Документ успешно удалён"
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка удаления документа",
            error: error.message
        });
    }
};

const downloadDocument = async (req, res) => {
    try {
        const documentId = req.params.id;

        const [documents] = await db.query(
            "SELECT * FROM documents WHERE id = ?",
            [documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const document = documents[0];

        const hasAccess = await checkDocumentAccess(
            documentId,
            req.user.id,
            req.user.role,
            document.uploaded_by
        );

        if (!hasAccess) {
            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [req.user.id, `Попытка скачивания чужого документа: ${document.title}`]
            );

            return res.status(403).json({
                message: "Недостаточно прав для скачивания документа"
            });
        }

        const filePath = path.join(
            __dirname,
            "../uploads",
            document.encrypted_file_name
        );

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                message: "Файл документа не найден"
            });
        }

        const encryptedData = fs.readFileSync(filePath, "utf8");

        const decryptedBytes = CryptoJS.AES.decrypt(
            encryptedData,
            process.env.AES_SECRET_KEY
        );

        const decryptedBase64 = decryptedBytes.toString(CryptoJS.enc.Utf8);
        const fileBuffer = Buffer.from(decryptedBase64, "base64");

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [req.user.id, `Скачивание документа: ${document.title}`]
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(document.file_name)}`
        );

        res.setHeader(
            "Content-Type",
            "application/octet-stream"
        );

        res.send(fileBuffer);

    } catch (error) {
        res.status(500).json({
            message: "Ошибка скачивания документа",
            error: error.message
        });
    }
};

const verifyDocument = async (req, res) => {
    try {
        const documentId = req.params.id;

        const [documents] = await db.query(
            "SELECT * FROM documents WHERE id = ?",
            [documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const document = documents[0];

        const hasAccess = await checkDocumentAccess(
            documentId,
            req.user.id,
            req.user.role,
            document.uploaded_by
        );

        if (!hasAccess) {
            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [req.user.id, `Попытка проверки чужого документа: ${document.title}`]
            );

            return res.status(403).json({
                message: "Недостаточно прав для проверки документа"
            });
        }

        const filePath = path.join(
            __dirname,
            "../uploads",
            document.encrypted_file_name
        );

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                message: "Файл документа не найден"
            });
        }

        const encryptedData = fs.readFileSync(filePath, "utf8");

        const decryptedBytes = CryptoJS.AES.decrypt(
            encryptedData,
            process.env.AES_SECRET_KEY
        );

        const decryptedBase64 = decryptedBytes.toString(CryptoJS.enc.Utf8);
        const fileBuffer = Buffer.from(decryptedBase64, "base64");

        const currentHash = crypto
            .createHash("sha256")
            .update(fileBuffer)
            .digest("hex");

        if (currentHash === document.file_hash) {
            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [req.user.id, `Проверка целостности документа: ${document.title}`]
            );

            return res.json({
                message: "Целостность документа подтверждена",
                originalHash: document.file_hash,
                currentHash
            });
        }

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [req.user.id, `Обнаружено изменение документа: ${document.title}`]
        );

        res.status(409).json({
            message: "Обнаружено изменение документа",
            originalHash: document.file_hash,
            currentHash
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка проверки целостности документа",
            error: error.message
        });
    }
};

const signDocument = async (req, res) => {
    try {
        const documentId = req.params.id;

        const [documents] = await db.query(
            "SELECT * FROM documents WHERE id = ?",
            [documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const document = documents[0];

        const hasAccess = await checkDocumentAccess(
            documentId,
            req.user.id,
            req.user.role,
            document.uploaded_by
        );

        if (!hasAccess) {
            return res.status(403).json({
                message: "Недостаточно прав для подписи документа"
            });
        }

        if (document.signature_hash) {
            return res.status(400).json({
                message: "Документ уже подписан ЭЦП"
            });
        }

        await db.query(
            `
            UPDATE documents
            SET
                signed_by = ?,
                signed_at = NOW(),
                signature_hash = ?,
                status = ?
            WHERE id = ?
            `,
            [
                req.user.id,
                document.file_hash,
                "Подписан ЭЦП",
                documentId
            ]
        );

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [
                req.user.id,
                `Подписание документа ЭЦП: ${document.title}`
            ]
        );

        res.json({
            message: "Документ успешно подписан ЭЦП",
            signatureHash: document.file_hash
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка подписи документа",
            error: error.message
        });
    }
};

const checkSignature = async (req, res) => {
    try {
        const documentId = req.params.id;

        const [documents] = await db.query(
            `
            SELECT documents.*, users.full_name
            FROM documents
            LEFT JOIN users
            ON documents.signed_by = users.id
            WHERE documents.id = ?
            `,
            [documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const document = documents[0];

        const hasAccess = await checkDocumentAccess(
            documentId,
            req.user.id,
            req.user.role,
            document.uploaded_by
        );

        if (!hasAccess) {
            return res.status(403).json({
                message: "Недостаточно прав для проверки подписи"
            });
        }

        if (!document.signature_hash) {
            return res.status(400).json({
                message: "Документ не подписан ЭЦП"
            });
        }

        const filePath = path.join(
            __dirname,
            "../uploads",
            document.encrypted_file_name
        );

        const encryptedData = fs.readFileSync(filePath, "utf8");

        const decryptedBytes = CryptoJS.AES.decrypt(
            encryptedData,
            process.env.AES_SECRET_KEY
        );

        const decryptedBase64 = decryptedBytes.toString(CryptoJS.enc.Utf8);
        const fileBuffer = Buffer.from(decryptedBase64, "base64");

        const currentHash = crypto
            .createHash("sha256")
            .update(fileBuffer)
            .digest("hex");

        if (currentHash === document.signature_hash) {
            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [
                    req.user.id,
                    `Проверка ЭЦП документа: ${document.title}`
                ]
            );

            return res.json({
                message: "ЭЦП действительна",
                signedBy: document.full_name,
                signedAt: document.signed_at
            });
        }

        res.status(409).json({
            message: "ЭЦП недействительна"
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка проверки ЭЦП",
            error: error.message
        });
    }
};

const viewStampedDocument = async (req, res) => {
    try {
        const documentId = req.params.id;

        const [documents] = await db.query(
            `
            SELECT 
                documents.*,
                users.full_name AS signed_user_name,
                users.role AS signed_user_role
            FROM documents
            LEFT JOIN users ON documents.signed_by = users.id
            WHERE documents.id = ?
            `,
            [documentId]
        );

        if (documents.length === 0) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const document = documents[0];

        const hasAccess = await checkDocumentAccess(
            documentId,
            req.user.id,
            req.user.role,
            document.uploaded_by
        );

        if (!hasAccess) {
            return res.status(403).json({
                message: "Недостаточно прав для просмотра ЭЦП"
            });
        }

        if (!document.signature_hash) {
            return res.status(400).json({
                message: "Документ ещё не подписан ЭЦП"
            });
        }

        const roleName =
            document.signed_user_role === "admin"
                ? "Администратор"
                : "Сотрудник";

        const signedDate =
            new Date(document.signed_at).toLocaleString("ru-RU");

        const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>Документ с электронной подписью</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #eef3f8;
                    padding: 40px;
                    color: #111827;
                }

                .page {
                    max-width: 850px;
                    margin: 0 auto;
                    background: white;
                    padding: 35px;
                    border-radius: 18px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.12);
                }

                h1 {
                    text-align: center;
                    margin-bottom: 25px;
                }

                .document-info {
                    border: 1px solid #d1d5db;
                    border-radius: 14px;
                    padding: 20px;
                    margin-bottom: 30px;
                    background: #f9fafb;
                }

                .signature {
                    border: 3px solid #2563eb;
                    border-radius: 18px;
                    padding: 25px;
                    background: #eff6ff;
                }

                .signature-title {
                    font-size: 22px;
                    font-weight: bold;
                    color: #1d4ed8;
                    margin-bottom: 18px;
                    text-align: center;
                }

                .row {
                    margin-bottom: 12px;
                    font-size: 16px;
                }

                .hash {
                    word-break: break-all;
                    font-family: monospace;
                    background: white;
                    padding: 12px;
                    border-radius: 10px;
                    margin-top: 10px;
                }

                .footer {
                    margin-top: 30px;
                    font-size: 14px;
                    color: #6b7280;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="page">
                <h1>Документ с электронной подписью</h1>

                <div class="document-info">
                    <div class="row"><b>Название документа:</b> ${document.title}</div>
                    <div class="row"><b>Файл:</b> ${document.file_name}</div>
                    <div class="row"><b>Дата загрузки:</b> ${new Date(document.created_at).toLocaleString("ru-RU")}</div>
                </div>

                <div class="signature">
                    <div class="signature-title">
                        Документ подписан простой электронной подписью
                    </div>

                    <div class="row"><b>ФИО подписанта:</b> ${document.signed_user_name}</div>
                    <div class="row"><b>Должность/роль:</b> ${roleName}</div>
                    <div class="row"><b>Дата подписания:</b> ${signedDate}</div>

                    <div class="row"><b>Уникальный ключ электронной подписи:</b></div>
                    <div class="hash">${document.signature_hash}</div>
                </div>

                <div class="footer">
                    Электронная подпись сформирована системой защищённого документооборота Secure DocFlow.
                </div>
            </div>
        </body>
        </html>
        `;

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [
                req.user.id,
                `Просмотр документа с ЭЦП: ${document.title}`
            ]
        );

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(html);

    } catch (error) {
        res.status(500).json({
            message: "Ошибка просмотра документа с ЭЦП",
            error: error.message
        });
    }
};

const createCorrection = async (req, res) => {
    try {
        const originalDocumentId = req.params.id;
        const file = req.files && req.files[0];
        const { title, recipients } = req.body;

        if (!file) {
            return res.status(400).json({
                message: "Файл исправления не загружен"
            });
        }

        if (!title) {
            return res.status(400).json({
                message: "Введите название исправления"
            });
        }

        const [originalDocuments] = await db.query(
            "SELECT * FROM documents WHERE id = ?",
            [originalDocumentId]
        );

        if (originalDocuments.length === 0) {
            return res.status(404).json({
                message: "Исходный документ не найден"
            });
        }

        const originalDocument = originalDocuments[0];

        const hasAccess = await checkDocumentAccess(
            originalDocumentId,
            req.user.id,
            req.user.role,
            originalDocument.uploaded_by
        );

        if (!hasAccess) {
            return res.status(403).json({
                message: "Недостаточно прав для создания исправления"
            });
        }

        if (!originalDocument.signature_hash) {
            return res.status(400).json({
                message: "Исправление создаётся только для подписанного ЭЦП документа"
            });
        }

        const filePath = path.join(__dirname, "../uploads", file.filename);
        const fileBuffer = fs.readFileSync(filePath);

        const fileHash = crypto
            .createHash("sha256")
            .update(fileBuffer)
            .digest("hex");

        const encryptedData = CryptoJS.AES.encrypt(
            fileBuffer.toString("base64"),
            process.env.AES_SECRET_KEY
        ).toString();

        fs.writeFileSync(filePath, encryptedData);

        const originalFileName = getOriginalFileName(file.originalname);

        const [insertResult] = await db.query(
            `
            INSERT INTO documents
            (title, file_name, encrypted_file_name, file_hash, uploaded_by, correction_of, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                title,
                originalFileName,
                file.filename,
                fileHash,
                req.user.id,
                originalDocumentId,
                "Исправление"
            ]
        );

        const newDocumentId = insertResult.insertId;
        const recipientIds = parseRecipients(recipients);

        for (const recipientId of recipientIds) {
            await db.query(
                `
                INSERT INTO document_recipients (document_id, user_id)
                VALUES (?, ?)
                `,
                [newDocumentId, recipientId]
            );
        }

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [
                req.user.id,
                `Создание исправления к документу: ${originalDocument.title}`
            ]
        );

        res.status(201).json({
            message: "Исправление создано как отдельный документ"
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка создания исправления",
            error: error.message
        });
    }
};

module.exports = {
    uploadDocument,
    getDocuments,
    deleteDocument,
    downloadDocument,
    verifyDocument,
    signDocument,
    checkSignature,
    viewStampedDocument,
    createCorrection
};