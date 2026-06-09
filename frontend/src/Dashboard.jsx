import { useEffect, useState } from "react";
import api from "./api";

function Dashboard() {
    const [activeSection, setActiveSection] = useState("documents");

    const [documents, setDocuments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [notifications, setNotifications] = useState([]);

    const [title, setTitle] = useState("");
    const [file, setFile] = useState(null);
    const [selectedReceiverId, setSelectedReceiverId] = useState("");
    const [receiverSearch, setReceiverSearch] = useState("");
    const [isReceiverListOpen, setIsReceiverListOpen] = useState(false);

    const [newFullName, setNewFullName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState("employee");

    const [editUserId, setEditUserId] = useState(null);
    const [editFullName, setEditFullName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editRole, setEditRole] = useState("employee");
    const [editPassword, setEditPassword] = useState("");

    const [documentFilter, setDocumentFilter] = useState("all");
    const [documentSearch, setDocumentSearch] = useState("");
    const [userSearch, setUserSearch] = useState("");

    const user = JSON.parse(localStorage.getItem("user"));

    useEffect(() => {
        loadDocuments();
        loadRecipients();
        loadNotifications();
    }, []);

    const getRoleName = (role) => {
        return role === "admin" ? "Администратор" : "Сотрудник";
    };

    const unreadCount = notifications.filter((item) => !item.is_read).length;

    const availableReceivers = users.filter((item) => item.id !== user.id);

    const filteredReceivers = availableReceivers.filter((item) => {
        const search = receiverSearch.toLowerCase();

        return (
            item.full_name?.toLowerCase().includes(search) ||
            item.email?.toLowerCase().includes(search)
        );
    });

    const selectedReceiver = users.find(
        (item) => Number(item.id) === Number(selectedReceiverId)
    );

    const getStatusBadgeStyle = (status) => {
        if (status === "Подписан") return styles.signedBadge;
        if (status === "Просмотрен") return styles.viewedBadge;
        if (status === "Аннулирован") return styles.cancelledBadge;
        return styles.processingBadge;
    };

    const filteredDocuments = documents.filter((doc) => {
        const search = documentSearch.toLowerCase();

        const matchesSearch =
            doc.title?.toLowerCase().includes(search) ||
            doc.full_name?.toLowerCase().includes(search) ||
            doc.author_name?.toLowerCase().includes(search) ||
            doc.receiver_name?.toLowerCase().includes(search) ||
            doc.file_name?.toLowerCase().includes(search) ||
            doc.status?.toLowerCase().includes(search);

        if (documentFilter === "processing") {
            return doc.status === "В обработке" && matchesSearch;
        }

        if (documentFilter === "viewed") {
            return doc.status === "Просмотрен" && matchesSearch;
        }

        if (documentFilter === "signed") {
            return doc.status === "Подписан" && matchesSearch;
        }

        if (documentFilter === "cancelled") {
            return doc.status === "Аннулирован" && matchesSearch;
        }

        return matchesSearch;
    });

    const filteredUsers = users.filter((item) => {
        const search = userSearch.toLowerCase();

        return (
            item.full_name?.toLowerCase().includes(search) ||
            item.email?.toLowerCase().includes(search) ||
            getRoleName(item.role).toLowerCase().includes(search)
        );
    });

    const validateName = (name) => {
        return /^[А-Яа-яЁёA-Za-z\s-]+$/.test(name.trim());
    };

    const validateEmail = (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    };

    const loadDocuments = async () => {
        try {
            const response = await api.get("/documents");
            setDocuments(response.data);
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка загрузки документов");
        }
    };

    const loadRecipients = async () => {
        try {
            const response = await api.get("/auth/recipients");
            setUsers(response.data);
        } catch {
            setUsers([]);
        }
    };

    const loadUsers = async () => {
        try {
            const response = await api.get("/auth/users");
            setUsers(response.data);
            setActiveSection("users");
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка загрузки пользователей");
        }
    };

    const loadLogs = async () => {
        try {
            const response = await api.get("/auth/logs");
            setLogs(response.data);
            setActiveSection("logs");
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка загрузки журнала событий");
        }
    };

    const loadNotifications = async () => {
        try {
            const response = await api.get("/documents/notifications");
            setNotifications(response.data);
        } catch (error) {
            console.log("Ошибка загрузки уведомлений:", error);
        }
    };

    const openDocuments = () => {
        loadDocuments();
        loadNotifications();
        setActiveSection("documents");
    };

    const openNotifications = async () => {
        try {
            setActiveSection("notifications");
            await api.post("/documents/notifications/read");
            await loadNotifications();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка открытия уведомлений");
        }
    };

    const createUser = async () => {
        if (!newFullName || !newEmail || !newPassword) {
            alert("Заполните ФИО, email и пароль");
            return;
        }

        if (!validateName(newFullName)) {
            alert("ФИО должно содержать только буквы, пробелы и дефис");
            return;
        }

        if (!validateEmail(newEmail)) {
            alert("Введите корректный email");
            return;
        }

        try {
            await api.post("/auth/register", {
                full_name: newFullName,
                email: newEmail,
                password: newPassword,
                role: newRole
            });

            alert("Пользователь создан");

            setNewFullName("");
            setNewEmail("");
            setNewPassword("");
            setNewRole("employee");

            loadUsers();
            loadRecipients();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка создания пользователя");
        }
    };

    const startEditUser = (item) => {
        setEditUserId(item.id);
        setEditFullName(item.full_name);
        setEditEmail(item.email);
        setEditRole(item.role);
        setEditPassword("");
    };

    const cancelEditUser = () => {
        setEditUserId(null);
        setEditFullName("");
        setEditEmail("");
        setEditRole("employee");
        setEditPassword("");
    };

    const updateUser = async () => {
        if (!editFullName || !editEmail || !editRole) {
            alert("Заполните ФИО, email и роль");
            return;
        }

        if (!validateName(editFullName)) {
            alert("ФИО должно содержать только буквы, пробелы и дефис");
            return;
        }

        if (!validateEmail(editEmail)) {
            alert("Введите корректный email");
            return;
        }

        try {
            await api.put(`/auth/users/${editUserId}`, {
                full_name: editFullName,
                email: editEmail,
                role: editRole,
                password: editPassword
            });

            alert("Данные пользователя обновлены");

            cancelEditUser();
            loadUsers();
            loadRecipients();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка редактирования пользователя");
        }
    };

    const deleteUser = async (id) => {
        if (!confirm("Удалить пользователя?")) return;

        try {
            await api.delete(`/auth/users/${id}`);

            alert("Пользователь удалён");
            loadUsers();
            loadRecipients();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка удаления пользователя");
        }
    };

    const uploadDocument = async () => {
        if (!title || !file || !selectedReceiverId) {
            alert("Введите название, выберите файл и одного получателя");
            return;
        }

        const formData = new FormData();

        formData.append("title", title);
        formData.append("document", file);
        formData.append("receiver_id", selectedReceiverId);

        try {
            await api.post("/documents/upload", formData);

            alert("Документ подписан отправителем и отправлен получателю");

            setTitle("");
            setFile(null);
            setSelectedReceiverId("");
            setReceiverSearch("");
            setIsReceiverListOpen(false);

            loadDocuments();
            loadNotifications();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка загрузки документа");
        }
    };

    const markViewed = async (doc) => {
        if (
            Number(doc.receiver_id) === Number(user.id) &&
            doc.status === "В обработке"
        ) {
            try {
                await api.post(`/documents/view/${doc.id}`);
                await loadDocuments();
                await loadNotifications();
            } catch (error) {
                console.log("Ошибка изменения статуса просмотра:", error);
            }
        }
    };

    const downloadDocument = async (doc) => {
        try {
            await markViewed(doc);

            const response = await api.get(`/documents/download/${doc.id}`, {
                responseType: "blob"
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");

            link.href = url;
            link.download = doc.file_name || "document";
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка скачивания документа");
        }
    };

    const signDocument = async (id) => {
        try {
            const response = await api.post(`/documents/sign/${id}`);
            alert(response.data.message);
            loadDocuments();
            loadNotifications();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка создания электронной подписи");
        }
    };

    const checkSignature = async (id) => {
        try {
            const response = await api.get(`/documents/check-sign/${id}`);

            const senderText = response.data.senderValid
                ? "ЭЦП отправителя действительна"
                : "ЭЦП отправителя недействительна";

            const receiverText =
                response.data.receiverValid === null
                    ? "ЭЦП получателя ещё нет"
                    : response.data.receiverValid
                        ? "ЭЦП получателя действительна"
                        : "ЭЦП получателя недействительна";

            alert(`${response.data.message}\n${senderText}\n${receiverText}`);
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка проверки ЭЦП");
        }
    };

    const viewStampedDocument = async (doc) => {
        try {
            await markViewed(doc);

            const response = await api.get(`/documents/stamped/${doc.id}`, {
                responseType: "text"
            });

            const newWindow = window.open("", "_blank");

            if (!newWindow) {
                alert("Браузер заблокировал открытие нового окна");
                return;
            }

            newWindow.document.open();
            newWindow.document.write(response.data);
            newWindow.document.close();

        } catch (error) {
            alert(
                error.response?.data?.message ||
                error.response?.data ||
                "Ошибка просмотра электронной подписи"
            );
        }
    };

    const cancelDocument = async (id) => {
        if (!confirm("Аннулировать документ?")) return;

        try {
            const response = await api.post(`/documents/cancel/${id}`);
            alert(response.data.message);
            loadDocuments();
            loadNotifications();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка аннулирования документа");
        }
    };

    const deleteDocument = async (id) => {
        if (!confirm("Удалить документ?")) return;

        try {
            await api.delete(`/documents/${id}`);
            alert("Документ удалён");
            loadDocuments();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка удаления документа");
        }
    };

    const canSenderSign = (doc) => {
        return (
            Number(doc.uploaded_by) === Number(user.id) &&
            doc.status !== "Аннулирован" &&
            !doc.sender_signature_hash
        );
    };

    const canReceiverSign = (doc) => {
        return (
            Number(doc.receiver_id) === Number(user.id) &&
            doc.status !== "Аннулирован" &&
            doc.status !== "Подписан" &&
            doc.sender_signature_hash &&
            !doc.receiver_signature_hash
        );
    };

    const canCancel = (doc) => {
        return (
            doc.status !== "Аннулирован" &&
            (user.role === "admin" ||
                Number(doc.uploaded_by) === Number(user.id) ||
                Number(doc.receiver_id) === Number(user.id))
        );
    };

    const canDelete = (doc) => {
        return (
            doc.status !== "Подписан" &&
            doc.status !== "Аннулирован" &&
            (user.role === "admin" ||
                Number(doc.uploaded_by) === Number(user.id))
        );
    };

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
    };

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Система защищённого документооборота</h1>
                    <p style={styles.subtitle}>Подсистема защиты электронных документов</p>
                </div>

                <div style={styles.headerActions}>
                    <button style={styles.navButton} onClick={openDocuments}>Документы</button>

                    <button style={styles.navButtonWithBadge} onClick={openNotifications}>
                        Уведомления
                        {unreadCount > 0 && (
                            <span style={styles.badge}>{unreadCount}</span>
                        )}
                    </button>

                    {user.role === "admin" && (
                        <>
                            <button style={styles.navButton} onClick={loadUsers}>Пользователи</button>
                            <button style={styles.navButton} onClick={loadLogs}>Журнал событий</button>
                        </>
                    )}

                    <button style={styles.logoutButton} onClick={logout}>Выйти</button>

                    <div style={styles.userCard}>
                        <p><b>Пользователь:</b> {user.full_name}</p>
                        <p><b>Роль:</b> {getRoleName(user.role)}</p>
                    </div>
                </div>
            </div>

            {activeSection === "documents" && (
                <>
                    <div style={styles.card}>
                        <h2 style={styles.sectionTitle}>Загрузка документа</h2>

                        <div style={styles.uploadBox}>
                            <input
                                style={styles.input}
                                placeholder="Название документа"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />

                            <input
                                type="file"
                                style={styles.input}
                                onChange={(e) => setFile(e.target.files[0])}
                            />

                            <button style={styles.addButton} onClick={uploadDocument}>
                                Подписать и отправить
                            </button>
                        </div>

                        <div style={styles.receiverBox}>
                            <h3 style={styles.smallTitle}>Получатель документа</h3>

                            <div style={styles.receiverSelector}>
                                <input
                                    style={styles.searchInput}
                                    placeholder="Начните вводить ФИО или email получателя..."
                                    value={
                                        isReceiverListOpen
                                            ? receiverSearch
                                            : selectedReceiver
                                                ? `${selectedReceiver.full_name} — ${selectedReceiver.email}`
                                                : receiverSearch
                                    }
                                    onFocus={() => {
                                        setIsReceiverListOpen(true);

                                        if (selectedReceiver) {
                                            setReceiverSearch("");
                                        }
                                    }}
                                    onChange={(e) => {
                                        setReceiverSearch(e.target.value);
                                        setSelectedReceiverId("");
                                        setIsReceiverListOpen(true);
                                    }}
                                />

                                {isReceiverListOpen && (
                                    <div style={styles.dropdown}>
                                        {filteredReceivers.length > 0 ? (
                                            filteredReceivers.map((item) => (
                                                <div
                                                    key={item.id}
                                                    style={styles.dropdownItem}
                                                    onClick={() => {
                                                        setSelectedReceiverId(item.id);
                                                        setReceiverSearch("");
                                                        setIsReceiverListOpen(false);
                                                    }}
                                                >
                                                    <b>{item.full_name}</b>
                                                    <span> — {item.email}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div style={styles.dropdownEmpty}>
                                                Получатели не найдены
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={styles.card}>
                        <h2 style={styles.sectionTitle}>Документы</h2>

                        <input
                            style={styles.searchInput}
                            placeholder="Поиск по документам, автору, получателю или статусу..."
                            value={documentSearch}
                            onChange={(e) => setDocumentSearch(e.target.value)}
                        />

                        <div style={styles.filterBox}>
                            <button
                                style={documentFilter === "all" ? styles.activeFilterButton : styles.filterButton}
                                onClick={() => setDocumentFilter("all")}
                            >
                                Все
                            </button>

                            <button
                                style={documentFilter === "processing" ? styles.activeFilterButton : styles.filterButton}
                                onClick={() => setDocumentFilter("processing")}
                            >
                                В обработке
                            </button>

                            <button
                                style={documentFilter === "viewed" ? styles.activeFilterButton : styles.filterButton}
                                onClick={() => setDocumentFilter("viewed")}
                            >
                                Просмотренные
                            </button>

                            <button
                                style={documentFilter === "signed" ? styles.activeFilterButton : styles.filterButton}
                                onClick={() => setDocumentFilter("signed")}
                            >
                                Подписанные
                            </button>

                            <button
                                style={documentFilter === "cancelled" ? styles.activeFilterButton : styles.filterButton}
                                onClick={() => setDocumentFilter("cancelled")}
                            >
                                Аннулированные
                            </button>
                        </div>

                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Название</th>
                                    <th style={styles.th}>Отправитель</th>
                                    <th style={styles.th}>Получатель</th>
                                    <th style={styles.th}>Дата</th>
                                    <th style={styles.th}>Статус</th>
                                    <th style={styles.th}>ЭЦП отправителя</th>
                                    <th style={styles.th}>ЭЦП получателя</th>
                                    <th style={styles.th}>Действия</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredDocuments.map((doc) => (
                                    <tr key={doc.id}>
                                        <td style={styles.td}>{doc.title}</td>
                                        <td style={styles.td}>{doc.author_name || doc.full_name || "—"}</td>
                                        <td style={styles.td}>{doc.receiver_name || "—"}</td>
                                        <td style={styles.td}>{new Date(doc.created_at).toLocaleString()}</td>

                                        <td style={styles.td}>
                                            <span style={getStatusBadgeStyle(doc.status)}>
                                                {doc.status || "В обработке"}
                                            </span>
                                        </td>

                                        <td style={styles.td}>{doc.sender_signed_name || "—"}</td>
                                        <td style={styles.td}>{doc.receiver_signed_name || "—"}</td>

                                        <td style={styles.td}>
                                            <button
                                                style={styles.actionButton}
                                                onClick={() => downloadDocument(doc)}
                                            >
                                                Скачать
                                            </button>

                                            {canSenderSign(doc) && (
                                                <button
                                                    style={styles.actionButton}
                                                    onClick={() => signDocument(doc.id)}
                                                >
                                                    Подписать отправителем
                                                </button>
                                            )}

                                            {canReceiverSign(doc) && (
                                                <button
                                                    style={styles.actionButton}
                                                    onClick={() => signDocument(doc.id)}
                                                >
                                                    Подписать получателем
                                                </button>
                                            )}

                                            <button
                                                style={styles.actionButton}
                                                onClick={() => viewStampedDocument(doc)}
                                            >
                                                Просмотреть ЭЦП
                                            </button>

                                            <button
                                                style={styles.actionButton}
                                                onClick={() => checkSignature(doc.id)}
                                            >
                                                Проверить ЭЦП
                                            </button>

                                            {canCancel(doc) && (
                                                <button
                                                    style={styles.cancelDocumentButton}
                                                    onClick={() => cancelDocument(doc.id)}
                                                >
                                                    Аннулировать
                                                </button>
                                            )}

                                            {canDelete(doc) && (
                                                <button
                                                    style={styles.deleteButton}
                                                    onClick={() => deleteDocument(doc.id)}
                                                >
                                                    Удалить
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredDocuments.length === 0 && (
                            <p style={styles.empty}>Документы не найдены</p>
                        )}
                    </div>
                </>
            )}

            {activeSection === "notifications" && (
                <div style={styles.card}>
                    <h2 style={styles.sectionTitle}>Уведомления</h2>

                    {notifications.length === 0 && (
                        <p style={styles.empty}>Уведомлений пока нет</p>
                    )}

                    {notifications.map((item) => (
                        <div
                            key={item.id}
                            style={item.is_read ? styles.notificationItem : styles.notificationUnread}
                        >
                            <div>{item.message}</div>
                            <small>{new Date(item.created_at).toLocaleString()}</small>
                        </div>
                    ))}
                </div>
            )}

            {activeSection === "users" && user.role === "admin" && (
                <div style={styles.card}>
                    <h2 style={styles.sectionTitle}>Управление пользователями</h2>

                    <div style={styles.userCreateBox}>
                        <input
                            style={styles.input}
                            placeholder="ФИО сотрудника"
                            value={newFullName}
                            onChange={(e) => setNewFullName(e.target.value)}
                        />

                        <input
                            style={styles.input}
                            placeholder="Email"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                        />

                        <input
                            style={styles.input}
                            type="password"
                            placeholder="Пароль"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />

                        <select
                            style={styles.input}
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                        >
                            <option value="employee">Сотрудник</option>
                            <option value="admin">Администратор</option>
                        </select>

                        <button style={styles.addButton} onClick={createUser}>
                            Создать пользователя
                        </button>
                    </div>

                    {editUserId && (
                        <div style={styles.editBox}>
                            <h3 style={styles.editTitle}>Редактирование пользователя</h3>

                            <div style={styles.userCreateBox}>
                                <input
                                    style={styles.input}
                                    placeholder="ФИО"
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                />

                                <input
                                    style={styles.input}
                                    placeholder="Email"
                                    value={editEmail}
                                    onChange={(e) => setEditEmail(e.target.value)}
                                />

                                <input
                                    style={styles.input}
                                    type="password"
                                    placeholder="Новый пароль"
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                />

                                <select
                                    style={styles.input}
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value)}
                                >
                                    <option value="employee">Сотрудник</option>
                                    <option value="admin">Администратор</option>
                                </select>

                                <div>
                                    <button style={styles.addButton} onClick={updateUser}>Сохранить</button>
                                    <button style={styles.cancelButton} onClick={cancelEditUser}>Отмена</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <input
                        style={styles.searchInput}
                        placeholder="Поиск по ФИО, email или роли..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                    />

                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>ФИО</th>
                                <th style={styles.th}>Электронная почта</th>
                                <th style={styles.th}>Роль</th>
                                <th style={styles.th}>Дата создания</th>
                                <th style={styles.th}>Действия</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredUsers.map((item) => (
                                <tr key={item.id}>
                                    <td style={styles.td}>{item.full_name}</td>
                                    <td style={styles.td}>{item.email}</td>
                                    <td style={styles.td}>{getRoleName(item.role)}</td>
                                    <td style={styles.td}>{new Date(item.created_at).toLocaleString()}</td>
                                    <td style={styles.td}>
                                        <button
                                            style={styles.actionButton}
                                            onClick={() => startEditUser(item)}
                                        >
                                            Редактировать
                                        </button>

                                        <button
                                            style={styles.deleteButton}
                                            onClick={() => deleteUser(item.id)}
                                        >
                                            Удалить
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeSection === "logs" && user.role === "admin" && (
                <div style={styles.card}>
                    <h2 style={styles.sectionTitle}>Журнал событий безопасности</h2>

                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Пользователь</th>
                                <th style={styles.th}>Email</th>
                                <th style={styles.th}>Действие</th>
                                <th style={styles.th}>Дата</th>
                            </tr>
                        </thead>

                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id}>
                                    <td style={styles.td}>{log.full_name}</td>
                                    <td style={styles.td}>{log.email}</td>
                                    <td style={styles.td}>{log.action}</td>
                                    <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {logs.length === 0 && (
                        <p style={styles.empty}>Журнал событий пуст</p>
                    )}
                </div>
            )}
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        background: "#eef3f8",
        padding: "35px",
        fontFamily: "Arial, sans-serif",
        color: "#111827"
    },

    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "30px",
        gap: "20px"
    },

    title: {
        fontSize: "32px",
        marginBottom: "8px"
    },

    subtitle: {
        color: "#6b7280"
    },

    headerActions: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap"
    },

    userCard: {
        background: "white",
        padding: "18px 25px",
        borderRadius: "14px",
        boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
        minWidth: "250px"
    },

    card: {
        background: "white",
        borderRadius: "18px",
        padding: "25px",
        marginBottom: "25px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.08)"
    },

    sectionTitle: {
        marginBottom: "18px"
    },

    smallTitle: {
        marginTop: "20px",
        marginBottom: "12px"
    },

    editBox: {
        background: "#f8fafc",
        border: "1px solid #dbeafe",
        borderRadius: "14px",
        padding: "20px",
        marginBottom: "22px"
    },

    editTitle: {
        marginBottom: "15px"
    },

    uploadBox: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto",
        gap: "15px",
        alignItems: "center"
    },

    userCreateBox: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 180px auto",
        gap: "15px",
        alignItems: "center",
        marginBottom: "22px"
    },

    input: {
        padding: "11px",
        borderRadius: "10px",
        border: "1px solid #d1d5db",
        fontSize: "14px"
    },

    searchInput: {
        width: "100%",
        padding: "12px",
        marginBottom: "10px",
        borderRadius: "10px",
        border: "1px solid #d1d5db",
        fontSize: "14px",
        boxSizing: "border-box"
    },

    receiverBox: {
        marginTop: "18px",
        padding: "18px",
        borderRadius: "14px",
        background: "#f8fafc",
        border: "1px solid #e5e7eb"
    },

    receiverSelector: {
        position: "relative"
    },

    dropdown: {
        position: "absolute",
        top: "52px",
        left: 0,
        right: 0,
        background: "white",
        border: "1px solid #d1d5db",
        borderRadius: "10px",
        boxShadow: "0 10px 20px rgba(0,0,0,0.12)",
        zIndex: 20,
        maxHeight: "220px",
        overflowY: "auto"
    },

    dropdownItem: {
        padding: "12px",
        cursor: "pointer",
        borderBottom: "1px solid #e5e7eb"
    },

    dropdownEmpty: {
        padding: "12px",
        color: "#6b7280"
    },

    filterBox: {
        display: "flex",
        gap: "10px",
        marginBottom: "18px",
        flexWrap: "wrap"
    },

    filterButton: {
        border: "none",
        padding: "9px 14px",
        borderRadius: "8px",
        background: "#e5e7eb",
        color: "#374151",
        cursor: "pointer"
    },

    activeFilterButton: {
        border: "none",
        padding: "9px 14px",
        borderRadius: "8px",
        background: "#2563eb",
        color: "white",
        cursor: "pointer"
    },

    addButton: {
        background: "#2563eb",
        color: "white",
        border: "none",
        padding: "12px 18px",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "14px",
        marginRight: "8px"
    },

    cancelButton: {
        background: "#6b7280",
        color: "white",
        border: "none",
        padding: "12px 18px",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "14px"
    },

    navButton: {
        background: "#111827",
        color: "white",
        border: "none",
        padding: "12px 18px",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "14px"
    },

    navButtonWithBadge: {
        position: "relative",
        background: "#111827",
        color: "white",
        border: "none",
        padding: "12px 18px",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "14px"
    },

    badge: {
        position: "absolute",
        top: "-8px",
        right: "-8px",
        background: "#ef4444",
        color: "white",
        width: "22px",
        height: "22px",
        borderRadius: "50%",
        fontSize: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold"
    },

    logoutButton: {
        background: "#6b7280",
        color: "white",
        border: "none",
        padding: "12px 18px",
        borderRadius: "10px",
        cursor: "pointer",
        fontSize: "14px"
    },

    table: {
        width: "100%",
        borderCollapse: "collapse"
    },

    th: {
        textAlign: "left",
        padding: "14px",
        background: "#f3f6fb",
        color: "#374151"
    },

    td: {
        padding: "14px",
        borderBottom: "1px solid #e5e7eb",
        verticalAlign: "middle"
    },

    actionButton: {
        marginRight: "8px",
        marginBottom: "6px",
        padding: "8px 12px",
        border: "none",
        borderRadius: "8px",
        background: "#e0ecff",
        color: "#1d4ed8",
        cursor: "pointer"
    },

    cancelDocumentButton: {
        marginRight: "8px",
        marginBottom: "6px",
        padding: "8px 12px",
        border: "none",
        borderRadius: "8px",
        background: "#ffedd5",
        color: "#c2410c",
        cursor: "pointer"
    },

    deleteButton: {
        padding: "8px 12px",
        border: "none",
        borderRadius: "8px",
        background: "#fee2e2",
        color: "#b91c1c",
        cursor: "pointer"
    },

    signedBadge: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: "8px",
        background: "#dcfce7",
        color: "#166534",
        fontSize: "13px",
        fontWeight: "bold"
    },

    viewedBadge: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: "8px",
        background: "#dbeafe",
        color: "#1d4ed8",
        fontSize: "13px",
        fontWeight: "bold"
    },

    processingBadge: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: "8px",
        background: "#fef3c7",
        color: "#92400e",
        fontSize: "13px",
        fontWeight: "bold"
    },

    cancelledBadge: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: "8px",
        background: "#fee2e2",
        color: "#991b1b",
        fontSize: "13px",
        fontWeight: "bold"
    },

    notificationItem: {
        padding: "14px",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        marginBottom: "10px",
        background: "#f9fafb"
    },

    notificationUnread: {
        padding: "14px",
        border: "1px solid #bfdbfe",
        borderRadius: "12px",
        marginBottom: "10px",
        background: "#eff6ff",
        fontWeight: "bold"
    },

    empty: {
        textAlign: "center",
        marginTop: "25px",
        color: "#6b7280"
    }
};

export default Dashboard;
