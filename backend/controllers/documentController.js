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

const checkDocumentAccess = (document, user) => {
    if (!document || !user) return false;
    if (user.role === "admin") return true;
    if (Number(document.uploaded_by) === Number(user.id)) return true;
    if (Number(document.receiver_id) === Number(user.id)) return true;
    return false;
};

const createNotification = async (userId, documentId, message) => {
    if (!userId) return;

    await db.query(
        `
        INSERT INTO notifications (user_id, document_id, message, is_read)
        VALUES (?, ?, ?, 0)
        `,
        [userId, documentId || null, message]
    );
};

const getDocumentById = async (documentId) => {
    const [documents] = await db.query(
        `
        SELECT 
            documents.*,

            authors.full_name AS author_name,
            authors.email AS author_email,

            receivers.full_name AS receiver_name,
            receivers.email AS receiver_email,

            senderUser.full_name AS sender_signed_name,
            receiverUser.full_name AS receiver_signed_name,

            cancelUser.full_name AS cancelled_user_name
        FROM documents
        LEFT JOIN users AS authors
            ON documents.uploaded_by = authors.id
        LEFT JOIN users AS receivers
            ON documents.receiver_id = receivers.id
        LEFT JOIN users AS senderUser
            ON documents.sender_signed_by = senderUser.id
        LEFT JOIN users AS receiverUser
            ON documents.receiver_signed_by = receiverUser.id
        LEFT JOIN users AS cancelUser
            ON documents.cancelled_by = cancelUser.id
        WHERE documents.id = ?
        `,
        [documentId]
    );

    return documents[0];
};

const readAndDecryptFile = (document) => {
    const filePath = path.join(
        __dirname,
        "../uploads",
        document.encrypted_file_name
    );

    if (!fs.existsSync(filePath)) {
        return {
            error: "Файл документа не найден на сервере"
        };
    }

    const encryptedData = fs.readFileSync(filePath, "utf8");

    const decryptedBytes = CryptoJS.AES.decrypt(
        encryptedData,
        process.env.AES_SECRET_KEY
    );

    const decryptedBase64 = decryptedBytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedBase64) {
        return {
            error: "Не удалось расшифровать документ"
        };
    }

    return {
        buffer: Buffer.from(decryptedBase64, "base64")
    };
};

const getHashFromBuffer = (buffer) => {
    return crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");
};

const uploadDocument = async (req, res) => {
    try {
        const file = req.files && req.files[0];

        if (!file) {
            return res.status(400).json({
                message: "Файл не загружен"
            });
        }

        const { title, receiver_id } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                message: "Введите название документа"
            });
        }

        if (!receiver_id) {
            return res.status(400).json({
                message: "Выберите одного получателя документа"
            });
        }

        if (Number(receiver_id) === Number(req.user.id)) {
            return res.status(400).json({
                message: "Нельзя отправить документ самому себе"
            });
        }

        const [receivers] = await db.query(
            "SELECT id, full_name FROM users WHERE id = ?",
            [receiver_id]
        );

        if (receivers.length === 0) {
            return res.status(404).json({
                message: "Получатель не найден"
            });
        }

        const filePath = path.join(__dirname, "../uploads", file.filename);
        const fileBuffer = fs.readFileSync(filePath);

        const fileHash = getHashFromBuffer(fileBuffer);

        const encryptedData = CryptoJS.AES.encrypt(
            fileBuffer.toString("base64"),
            process.env.AES_SECRET_KEY
        ).toString();

        fs.writeFileSync(filePath, encryptedData);

        const originalFileName = getOriginalFileName(file.originalname);

        const [insertResult] = await db.query(
            `
            INSERT INTO documents
            (
                title,
                file_name,
                encrypted_file_name,
                file_hash,
                uploaded_by,
                receiver_id,
                status,
                signed_by,
                signed_at,
                signature_hash,
                sender_signed_by,
                sender_signed_at,
                sender_signature_hash
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW(), ?)
            `,
            [
                title.trim(),
                originalFileName,
                file.filename,
                fileHash,
                req.user.id,
                receiver_id,
                "В обработке",
                req.user.id,
                fileHash,
                req.user.id,
                fileHash
            ]
        );

        const documentId = insertResult.insertId;

        await createNotification(
            receiver_id,
            documentId,
            `Вам поступил новый документ: ${title.trim()}`
        );

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [
                req.user.id,
                `Загрузка, подпись и отправка документа: ${title.trim()}`
            ]
        );

        res.status(201).json({
            message: "Документ подписан отправителем и отправлен получателю",
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
                documents.uploaded_by,
                documents.receiver_id,
                documents.status,
                documents.created_at,
                documents.signed_by,
                documents.signed_at,
                documents.signature_hash,
                documents.sender_signed_by,
                documents.sender_signed_at,
                documents.sender_signature_hash,
                documents.receiver_signed_by,
                documents.receiver_signed_at,
                documents.receiver_signature_hash,
                documents.viewed_at,
                documents.cancelled_at,
                documents.cancelled_by,

                authors.full_name AS full_name,
                authors.full_name AS author_name,
                authors.email AS author_email,

                receivers.full_name AS receiver_name,
                receivers.email AS receiver_email,

                senderUser.full_name AS sender_signed_name,
                receiverUser.full_name AS receiver_signed_name,

                cancelUser.full_name AS cancelled_user_name
            FROM documents
            LEFT JOIN users AS authors
                ON documents.uploaded_by = authors.id
            LEFT JOIN users AS receivers
                ON documents.receiver_id = receivers.id
            LEFT JOIN users AS senderUser
                ON documents.sender_signed_by = senderUser.id
            LEFT JOIN users AS receiverUser
                ON documents.receiver_signed_by = receiverUser.id
            LEFT JOIN users AS cancelUser
                ON documents.cancelled_by = cancelUser.id
        `;

        let params = [];

        if (req.user.role !== "admin") {
            query += `
                WHERE documents.uploaded_by = ?
                OR documents.receiver_id = ?
            `;

            params = [req.user.id, req.user.id];
        }

        query += `
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

const markDocumentViewed = async (req, res) => {
    try {
        const documentId = req.params.id;
        const document = await getDocumentById(documentId);

        if (!document) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const hasAccess = checkDocumentAccess(document, req.user);

        if (!hasAccess) {
            return res.status(403).json({
                message: "Недостаточно прав для просмотра документа"
            });
        }

        if (
            Number(document.receiver_id) === Number(req.user.id) &&
            document.status === "В обработке"
        ) {
            await db.query(
                `
                UPDATE documents
                SET status = ?, viewed_at = NOW()
                WHERE id = ?
                `,
                ["Просмотрен", documentId]
            );

            await createNotification(
                document.uploaded_by,
                documentId,
                `Получатель просмотрел документ: ${document.title}`
            );

            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [req.user.id, `Просмотр входящего документа: ${document.title}`]
            );
        }

        res.json({
            message: "Документ отмечен как просмотренный"
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка просмотра документа",
            error: error.message
        });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const documentId = req.params.id;
        const document = await getDocumentById(documentId);

        if (!document) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        if (document.status === "Подписан" || document.status === "Аннулирован") {
            return res.status(403).json({
                message: "Подписанный или аннулированный документ нельзя удалить"
            });
        }

        if (
            req.user.role !== "admin" &&
            Number(document.uploaded_by) !== Number(req.user.id)
        ) {
            return res.status(403).json({
                message: "Удалить документ может только отправитель или администратор"
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
        const document = await getDocumentById(documentId);

        if (!document) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const hasAccess = checkDocumentAccess(document, req.user);

        if (!hasAccess) {
            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [req.user.id, `Попытка скачивания чужого документа: ${document.title}`]
            );

            return res.status(403).json({
                message: "Недостаточно прав для скачивания документа"
            });
        }

        if (document.status === "Аннулирован") {
            return res.status(400).json({
                message: "Аннулированный документ нельзя скачать"
            });
        }

        const result = readAndDecryptFile(document);

        if (result.error) {
            return res.status(404).json({
                message: result.error
            });
        }

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

        res.send(result.buffer);

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
        const document = await getDocumentById(documentId);

        if (!document) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const hasAccess = checkDocumentAccess(document, req.user);

        if (!hasAccess) {
            return res.status(403).json({
                message: "Недостаточно прав для проверки документа"
            });
        }

        const result = readAndDecryptFile(document);

        if (result.error) {
            return res.status(404).json({
                message: result.error
            });
        }

        const currentHash = getHashFromBuffer(result.buffer);

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
        const document = await getDocumentById(documentId);

        if (!document) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const hasAccess = checkDocumentAccess(document, req.user);

        if (!hasAccess) {
            return res.status(403).json({
                message: "Недостаточно прав для подписи документа"
            });
        }

        if (document.status === "Аннулирован") {
            return res.status(400).json({
                message: "Аннулированный документ нельзя подписать"
            });
        }

        if (document.status === "Подписан") {
            return res.status(400).json({
                message: "Документ уже подписан обеими сторонами"
            });
        }

        if (Number(req.user.id) === Number(document.uploaded_by)) {
            if (document.sender_signature_hash) {
                return res.status(400).json({
                    message: "Отправитель уже подписал документ"
                });
            }

            await db.query(
                `
                UPDATE documents
                SET
                    sender_signed_by = ?,
                    sender_signed_at = NOW(),
                    sender_signature_hash = ?,
                    signed_by = ?,
                    signed_at = NOW(),
                    signature_hash = ?,
                    status = ?
                WHERE id = ?
                `,
                [
                    req.user.id,
                    document.file_hash,
                    req.user.id,
                    document.file_hash,
                    "В обработке",
                    documentId
                ]
            );

            await createNotification(
                document.receiver_id,
                documentId,
                `Вам поступил новый документ: ${document.title}`
            );

            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [req.user.id, `Подписание документа отправителем: ${document.title}`]
            );

            return res.json({
                message: "Документ подписан отправителем и отправлен получателю"
            });
        }

        if (Number(req.user.id) === Number(document.receiver_id)) {
            if (!document.sender_signature_hash) {
                return res.status(400).json({
                    message: "Документ ещё не подписан отправителем"
                });
            }

            if (document.receiver_signature_hash) {
                return res.status(400).json({
                    message: "Получатель уже подписал документ"
                });
            }

            await db.query(
                `
                UPDATE documents
                SET
                    receiver_signed_by = ?,
                    receiver_signed_at = NOW(),
                    receiver_signature_hash = ?,
                    status = ?
                WHERE id = ?
                `,
                [
                    req.user.id,
                    document.file_hash,
                    "Подписан",
                    documentId
                ]
            );

            await createNotification(
                document.uploaded_by,
                documentId,
                `Документ подписан второй стороной: ${document.title}`
            );

            await db.query(
                "INSERT INTO logs (user_id, action) VALUES (?, ?)",
                [req.user.id, `Подписание документа получателем: ${document.title}`]
            );

            return res.json({
                message: "Документ подписан второй стороной"
            });
        }

        return res.status(403).json({
            message: "Подписать документ может только отправитель или получатель"
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
        const document = await getDocumentById(documentId);

        if (!document) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const hasAccess = checkDocumentAccess(document, req.user);

        if (!hasAccess) {
            return res.status(403).json({
                message: "Недостаточно прав для проверки подписи"
            });
        }

        if (!document.sender_signature_hash) {
            return res.status(400).json({
                message: "Документ ещё не подписан отправителем"
            });
        }

        const result = readAndDecryptFile(document);

        if (result.error) {
            return res.status(404).json({
                message: result.error
            });
        }

        const currentHash = getHashFromBuffer(result.buffer);

        const senderValid = currentHash === document.sender_signature_hash;
        const receiverValid = document.receiver_signature_hash
            ? currentHash === document.receiver_signature_hash
            : null;

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [
                req.user.id,
                `Проверка ЭЦП документа: ${document.title}`
            ]
        );

        return res.json({
            message: senderValid && (receiverValid === true || receiverValid === null)
                ? "ЭЦП действительна"
                : "ЭЦП недействительна",
            senderValid,
            receiverValid,
            senderSignedBy: document.sender_signed_name,
            senderSignedAt: document.sender_signed_at,
            receiverSignedBy: document.receiver_signed_name,
            receiverSignedAt: document.receiver_signed_at
        });

    } catch (error) {
        console.error("Ошибка проверки ЭЦП:", error);

        res.status(500).json({
            message: "Ошибка проверки ЭЦП",
            error: error.message
        });
    }
};

const viewStampedDocument = async (req, res) => {
    try {
        const documentId = req.params.id;
        const document = await getDocumentById(documentId);

        if (!document) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const hasAccess = checkDocumentAccess(document, req.user);

        if (!hasAccess) {
            return res.status(403).json({
                message: "Недостаточно прав для просмотра ЭЦП"
            });
        }

        if (!document.sender_signature_hash) {
            return res.status(400).json({
                message: "Документ ещё не подписан ЭЦП"
            });
        }

        const formatDate = (date) => {
            return date ? new Date(date).toLocaleString("ru-RU") : "—";
        };

        const receiverBlock = document.receiver_signature_hash
            ? `
                <div class="signature">
                    <div class="signature-title">ЭЦП получателя</div>
                    <div class="row"><b>ФИО подписанта:</b> ${document.receiver_signed_name || "—"}</div>
                    <div class="row"><b>Дата подписания:</b> ${formatDate(document.receiver_signed_at)}</div>
                    <div class="row"><b>Hash подписи:</b></div>
                    <div class="hash">${document.receiver_signature_hash}</div>
                </div>
            `
            : `
                <div class="signature waiting">
                    <div class="signature-title">ЭЦП получателя</div>
                    <div class="row">Документ ожидает подписи получателя.</div>
                </div>
            `;

        const html = `
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
           <link rel="icon" type="image/x-icon" href="https://secure-docflow.vercel.app/icon.ico">
<title>ЭЦП документа</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #eef3f8;
                    padding: 40px;
                    color: #111827;
                }

                .page {
                    max-width: 900px;
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
                    margin-bottom: 25px;
                    background: #f9fafb;
                }

                .signature {
                    border: 3px solid #2563eb;
                    border-radius: 18px;
                    padding: 25px;
                    background: #eff6ff;
                    margin-bottom: 20px;
                }

                .waiting {
                    border-color: #f59e0b;
                    background: #fffbeb;
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
                <h1>Документ с электронными подписями</h1>

                <div class="document-info">
                    <div class="row"><b>Название документа:</b> ${document.title}</div>
                    <div class="row"><b>Файл:</b> ${document.file_name}</div>
                    <div class="row"><b>Автор:</b> ${document.author_name || "—"}</div>
                    <div class="row"><b>Получатель:</b> ${document.receiver_name || "—"}</div>
                    <div class="row"><b>Статус:</b> ${document.status}</div>
                    <div class="row"><b>Дата загрузки:</b> ${formatDate(document.created_at)}</div>
                </div>

                <div class="signature">
                    <div class="signature-title">ЭЦП отправителя</div>
                    <div class="row"><b>ФИО подписанта:</b> ${document.sender_signed_name || "—"}</div>
                    <div class="row"><b>Дата подписания:</b> ${formatDate(document.sender_signed_at)}</div>
                    <div class="row"><b>Hash подписи:</b></div>
                    <div class="hash">${document.sender_signature_hash}</div>
                </div>

                ${receiverBlock}

                <div class="footer">
                    Электронные подписи сформированы системой защищённого документооборота Secure DocFlow.
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

const cancelDocument = async (req, res) => {
    try {
        const documentId = req.params.id;
        const document = await getDocumentById(documentId);

        if (!document) {
            return res.status(404).json({
                message: "Документ не найден"
            });
        }

        const canCancel =
            req.user.role === "admin" ||
            Number(req.user.id) === Number(document.uploaded_by) ||
            Number(req.user.id) === Number(document.receiver_id);

        if (!canCancel) {
            return res.status(403).json({
                message: "Аннулировать документ может только отправитель, получатель или администратор"
            });
        }

        if (document.status === "Аннулирован") {
            return res.status(400).json({
                message: "Документ уже аннулирован"
            });
        }

        await db.query(
            `
            UPDATE documents
            SET status = ?, cancelled_at = NOW(), cancelled_by = ?
            WHERE id = ?
            `,
            ["Аннулирован", req.user.id, documentId]
        );

        const otherUserId =
            Number(req.user.id) === Number(document.uploaded_by)
                ? document.receiver_id
                : document.uploaded_by;

        await createNotification(
            otherUserId,
            documentId,
            `Документ аннулирован: ${document.title}`
        );

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [req.user.id, `Аннулирование документа: ${document.title}`]
        );

        res.json({
            message: "Документ аннулирован"
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка аннулирования документа",
            error: error.message
        });
    }
};

const getNotifications = async (req, res) => {
    try {
        const [notifications] = await db.query(
            `
            SELECT *
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            `,
            [req.user.id]
        );

        res.json(notifications);

    } catch (error) {
        res.status(500).json({
            message: "Ошибка получения уведомлений",
            error: error.message
        });
    }
};

const markNotificationsRead = async (req, res) => {
    try {
        await db.query(
            "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
            [req.user.id]
        );

        res.json({
            message: "Уведомления прочитаны"
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка обновления уведомлений",
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
    cancelDocument,
    markDocumentViewed,
    getNotifications,
    markNotificationsRead
};