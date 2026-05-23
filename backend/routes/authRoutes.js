const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const {
    register,
    login
} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const db = require("../config/db");

router.post("/register", authMiddleware, async (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Создавать пользователей может только администратор"
        });
    }

    next();
}, register);

router.post("/login", login);

router.get("/profile", authMiddleware, (req, res) => {
    res.json({
        message: "Доступ разрешён",
        user: req.user
    });
});
router.get("/recipients", authMiddleware, async (req, res) => {
    try {
        const [users] = await db.query(
            `
            SELECT id, full_name, email, role
            FROM users
            WHERE id != ?
            ORDER BY full_name ASC
            `,
            [req.user.id]
        );

        res.json(users);

    } catch (error) {
        res.status(500).json({
            message: "Ошибка получения списка получателей",
            error: error.message
        });
    }
}); 
router.get("/logs", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Доступ к журналу разрешён только администратору"
        });
    }

    try {
        const [logs] = await db.query(`
            SELECT 
                logs.id,
                users.full_name,
                users.email,
                logs.action,
                logs.created_at
            FROM logs
            LEFT JOIN users
            ON logs.user_id = users.id
            ORDER BY logs.created_at DESC
        `);

        res.json(logs);

    } catch (error) {
        res.status(500).json({
            message: "Ошибка получения журнала действий",
            error: error.message
        });
    }
});

router.get("/users", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Доступ к списку пользователей разрешён только администратору"
        });
    }

    try {
        const [users] = await db.query(`
            SELECT id, full_name, email, role, created_at
            FROM users
            ORDER BY created_at DESC
        `);

        res.json(users);

    } catch (error) {
        res.status(500).json({
            message: "Ошибка получения списка пользователей",
            error: error.message
        });
    }
});
router.put("/users/:id", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Редактировать пользователей может только администратор"
        });
    }

    try {
        const userId = req.params.id;
        const { full_name, email, role, password } = req.body;

        if (!full_name || !email || !role) {
            return res.status(400).json({
                message: "Заполните ФИО, email и роль"
            });
        }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);

            await db.query(
                `
                UPDATE users
                SET full_name = ?, email = ?, role = ?, password = ?
                WHERE id = ?
                `,
                [full_name, email, role, hashedPassword, userId]
            );
        } else {
            await db.query(
                `
                UPDATE users
                SET full_name = ?, email = ?, role = ?
                WHERE id = ?
                `,
                [full_name, email, role, userId]
            );
        }

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [req.user.id, `Редактирование пользователя с ID: ${userId}`]
        );

        res.json({
            message: "Данные пользователя обновлены"
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка редактирования пользователя",
            error: error.message
        });
    }
});

router.delete("/users/:id", authMiddleware, async (req, res) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Удалять пользователей может только администратор"
        });
    }

    try {
        const userId = req.params.id;

        if (Number(userId) === req.user.id) {
            return res.status(400).json({
                message: "Нельзя удалить самого себя"
            });
        }

        await db.query(
            "DELETE FROM users WHERE id = ?",
            [userId]
        );

        await db.query(
            "INSERT INTO logs (user_id, action) VALUES (?, ?)",
            [req.user.id, `Удаление пользователя с ID: ${userId}`]
        );

        res.json({
            message: "Пользователь удалён"
        });

    } catch (error) {
        res.status(500).json({
            message: "Ошибка удаления пользователя",
            error: error.message
        });
    }
});

module.exports = router;