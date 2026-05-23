import { useEffect, useState } from "react";
import api from "./api";

function Dashboard() {
    const [activeSection, setActiveSection] = useState("documents");

    const [documents, setDocuments] = useState([]);
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);

    const [title, setTitle] = useState("");
    const [file, setFile] = useState(null);
    const [selectedRecipients, setSelectedRecipients] = useState([]);
    const [recipientSearch, setRecipientSearch] = useState("");

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

    const [correctionDocument, setCorrectionDocument] = useState(null);
    const [correctionTitle, setCorrectionTitle] = useState("");
    const [correctionFile, setCorrectionFile] = useState(null);
    const [correctionRecipients, setCorrectionRecipients] = useState([]);
    const [correctionSearch, setCorrectionSearch] = useState("");

    const user = JSON.parse(localStorage.getItem("user"));

    useEffect(() => {
    loadDocuments();
    loadAllUsersForRecipients();
}, []);

    const getRoleName = (role) => {
        return role === "admin" ? "Администратор" : "Сотрудник";
    };

    const availableRecipients = users.filter((item) => item.id !== user.id);

    const filteredRecipients = availableRecipients.filter((item) => {
        const search = recipientSearch.toLowerCase();
        return (
            item.full_name?.toLowerCase().includes(search) ||
            item.email?.toLowerCase().includes(search)
        );
    });

    const filteredCorrectionRecipients = availableRecipients.filter((item) => {
        const search = correctionSearch.toLowerCase();
        return (
            item.full_name?.toLowerCase().includes(search) ||
            item.email?.toLowerCase().includes(search)
        );
    });

    const filteredDocuments = documents.filter((doc) => {
        const search = documentSearch.toLowerCase();

        const matchesSearch =
            doc.title?.toLowerCase().includes(search) ||
            doc.full_name?.toLowerCase().includes(search) ||
            doc.file_name?.toLowerCase().includes(search) ||
            doc.recipients_names?.toLowerCase().includes(search);

        if (documentFilter === "signed") {
            return doc.signature_hash && matchesSearch;
        }

        if (documentFilter === "notSigned") {
            return !doc.signature_hash && matchesSearch;
        }

        if (documentFilter === "corrections") {
            return doc.correction_of && matchesSearch;
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

    const loadDocuments = async () => {
        try {
            const response = await api.get("/documents");
            setDocuments(response.data);
        } catch {
            alert("Ошибка загрузки документов");
        }
    };

    const loadAllUsersForRecipients = async () => {
    try {
        const response = await api.get("/auth/recipients");
        setUsers(response.data);
    } catch (error) {
        console.log("Ошибка загрузки получателей:", error);
    }
};

    const loadUsersForRecipients = async () => {
        try {
            const response = await api.get("/auth/users");
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

    const openDocuments = () => {
        loadDocuments();
        setActiveSection("documents");
    };

    const toggleRecipient = (id) => {
        setSelectedRecipients((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const toggleCorrectionRecipient = (id) => {
        setCorrectionRecipients((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const createUser = async () => {
        if (!newFullName || !newEmail || !newPassword) {
            alert("Заполните ФИО, email и пароль");
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
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка удаления пользователя");
        }
    };

    const uploadDocument = async () => {
        if (!title || !file) {
            alert("Введите название и выберите файл");
            return;
        }

        const formData = new FormData();
        formData.append("title", title);
        formData.append("document", file);
        formData.append("recipients", JSON.stringify(selectedRecipients));

        try {
            await api.post("/documents/upload", formData);

            alert("Документ загружен, зашифрован и отправлен получателям");
            setTitle("");
            setFile(null);
            setSelectedRecipients([]);
            setRecipientSearch("");
            loadDocuments();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка загрузки документа");
        }
    };

    const downloadDocument = async (id, fileName) => {
        try {
            const response = await api.get(`/documents/download/${id}`, {
                responseType: "blob"
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");

            link.href = url;
            link.download = fileName || "document";
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
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка создания электронной подписи");
        }
    };

    const checkSignature = async (id) => {
        try {
            const response = await api.get(`/documents/check-sign/${id}`);
            alert(response.data.message);
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка проверки ЭЦП");
        }
    };

    const viewStampedDocument = async (id) => {
        try {
            const response = await api.get(`/documents/stamped/${id}`, {
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

    const openCorrectionModal = (doc) => {
        setCorrectionDocument(doc);
        setCorrectionTitle(`Исправление к документу: ${doc.title}`);
        setCorrectionFile(null);
        setCorrectionRecipients([]);
        setCorrectionSearch("");
    };

    const closeCorrectionModal = () => {
        setCorrectionDocument(null);
        setCorrectionTitle("");
        setCorrectionFile(null);
        setCorrectionRecipients([]);
        setCorrectionSearch("");
    };

    const createCorrection = async () => {
        if (!correctionDocument || !correctionTitle || !correctionFile) {
            alert("Введите название исправления и выберите файл");
            return;
        }

        const formData = new FormData();
        formData.append("title", correctionTitle);
        formData.append("document", correctionFile);
        formData.append("recipients", JSON.stringify(correctionRecipients));

        try {
            await api.post(`/documents/correction/${correctionDocument.id}`, formData);
            alert("Исправление создано как отдельный документ");
            closeCorrectionModal();
            loadDocuments();
        } catch (error) {
            alert(error.response?.data?.message || "Ошибка создания исправления");
        }
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
                                Загрузить документ
                            </button>
                        </div>

                        <div style={styles.recipientsBox}>
                            <h3 style={styles.smallTitle}>Получатели документа</h3>

                            <input
                                style={styles.searchInput}
                                placeholder="Поиск получателя по ФИО или email..."
                                value={recipientSearch}
                                onChange={(e) => setRecipientSearch(e.target.value)}
                            />

                            <div style={styles.checkList}>
                                {filteredRecipients.map((item) => (
                                    <label key={item.id} style={styles.checkItem}>
                                        <input
                                            type="checkbox"
                                            checked={selectedRecipients.includes(item.id)}
                                            onChange={() => toggleRecipient(item.id)}
                                        />
                                        <span>{item.full_name} — {item.email}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={styles.card}>
                        <h2 style={styles.sectionTitle}>Документы</h2>

                        <input
                            style={styles.searchInput}
                            placeholder="Поиск по документам, автору, получателю или имени файла..."
                            value={documentSearch}
                            onChange={(e) => setDocumentSearch(e.target.value)}
                        />

                        {documentSearch && (
                            <div style={styles.suggestions}>
                                {filteredDocuments.slice(0, 5).map((doc) => (
                                    <div
                                        key={doc.id}
                                        style={styles.suggestionItem}
                                        onClick={() => setDocumentSearch(doc.title)}
                                    >
                                        {doc.title} — {doc.full_name}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={styles.filterBox}>
                            <button
                                style={documentFilter === "all" ? styles.activeFilterButton : styles.filterButton}
                                onClick={() => setDocumentFilter("all")}
                            >
                                Все
                            </button>

                            <button
                                style={documentFilter === "signed" ? styles.activeFilterButton : styles.filterButton}
                                onClick={() => setDocumentFilter("signed")}
                            >
                                Подписанные ЭЦП
                            </button>

                            <button
                                style={documentFilter === "notSigned" ? styles.activeFilterButton : styles.filterButton}
                                onClick={() => setDocumentFilter("notSigned")}
                            >
                                Не подписанные
                            </button>

                            <button
                                style={documentFilter === "corrections" ? styles.activeFilterButton : styles.filterButton}
                                onClick={() => setDocumentFilter("corrections")}
                            >
                                Исправления
                            </button>
                        </div>

                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Название</th>
                                    <th style={styles.th}>Автор</th>
                                    <th style={styles.th}>Получатели</th>
                                    <th style={styles.th}>Дата загрузки</th>
                                    <th style={styles.th}>Статус</th>
                                    <th style={styles.th}>Подписал</th>
                                    <th style={styles.th}>Действия</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredDocuments.map((doc) => (
                                    <tr key={doc.id}>
                                        <td style={styles.td}>
                                            {doc.title}
                                            {doc.correction_of && (
                                                <div style={styles.correctionLabel}>Исправление</div>
                                            )}
                                        </td>
                                        <td style={styles.td}>{doc.full_name}</td>
                                        <td style={styles.td}>{doc.recipients_names || "—"}</td>
                                        <td style={styles.td}>{new Date(doc.created_at).toLocaleString()}</td>

                                        <td style={styles.td}>
                                            {doc.signature_hash ? (
                                                <span style={styles.signedBadge}>Подписан ЭЦП</span>
                                            ) : (
                                                <span style={styles.notSignedBadge}>Не подписан</span>
                                            )}
                                        </td>

                                        <td style={styles.td}>{doc.signed_user_name || "—"}</td>

                                        <td style={styles.td}>
                                            <button
                                                style={styles.actionButton}
                                                onClick={() => downloadDocument(doc.id, doc.file_name)}
                                            >
                                                Скачать
                                            </button>

                                            {!doc.signature_hash && (
                                                <button
                                                    style={styles.actionButton}
                                                    onClick={() => signDocument(doc.id)}
                                                >
                                                    Подписать ЭЦП
                                                </button>
                                            )}

                                            {doc.signature_hash && (
                                                <button
                                                    style={styles.actionButton}
                                                    onClick={() => viewStampedDocument(doc.id)}
                                                >
                                                    Просмотреть ЭЦП
                                                </button>
                                            )}

                                            <button
                                                style={styles.actionButton}
                                                onClick={() => checkSignature(doc.id)}
                                            >
                                                Проверить ЭЦП
                                            </button>

                                            {doc.signature_hash && (
                                                <button
                                                    style={styles.actionButton}
                                                    onClick={() => openCorrectionModal(doc)}
                                                >
                                                    Создать исправление
                                                </button>
                                            )}

                                            {!doc.signature_hash && (
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

            {correctionDocument && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modal}>
                        <h2 style={styles.sectionTitle}>Создание исправления</h2>
                        <p style={styles.modalText}>
                            Исправление создаётся как отдельный документ к подписанному ЭЦП документу: <b>{correctionDocument.title}</b>
                        </p>

                        <input
                            style={styles.inputFull}
                            placeholder="Название исправления"
                            value={correctionTitle}
                            onChange={(e) => setCorrectionTitle(e.target.value)}
                        />

                        <input
                            type="file"
                            style={styles.inputFull}
                            onChange={(e) => setCorrectionFile(e.target.files[0])}
                        />

                        <h3 style={styles.smallTitle}>Получатели исправления</h3>

                        <input
                            style={styles.searchInput}
                            placeholder="Поиск получателя..."
                            value={correctionSearch}
                            onChange={(e) => setCorrectionSearch(e.target.value)}
                        />

                        <div style={styles.checkList}>
                            {filteredCorrectionRecipients.map((item) => (
                                <label key={item.id} style={styles.checkItem}>
                                    <input
                                        type="checkbox"
                                        checked={correctionRecipients.includes(item.id)}
                                        onChange={() => toggleCorrectionRecipient(item.id)}
                                    />
                                    <span>{item.full_name} — {item.email}</span>
                                </label>
                            ))}
                        </div>

                        <div style={styles.modalActions}>
                            <button style={styles.addButton} onClick={createCorrection}>Создать исправление</button>
                            <button style={styles.cancelButton} onClick={closeCorrectionModal}>Отмена</button>
                        </div>
                    </div>
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
        gap: "12px"
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

    inputFull: {
        width: "100%",
        padding: "11px",
        borderRadius: "10px",
        border: "1px solid #d1d5db",
        fontSize: "14px",
        marginBottom: "12px"
    },

    searchInput: {
        width: "100%",
        padding: "12px",
        marginBottom: "10px",
        borderRadius: "10px",
        border: "1px solid #d1d5db",
        fontSize: "14px"
    },

    suggestions: {
        background: "white",
        border: "1px solid #d1d5db",
        borderRadius: "10px",
        marginBottom: "18px",
        overflow: "hidden"
    },

    suggestionItem: {
        padding: "10px 12px",
        cursor: "pointer",
        borderBottom: "1px solid #e5e7eb"
    },

    recipientsBox: {
        marginTop: "18px",
        padding: "18px",
        borderRadius: "14px",
        background: "#f8fafc",
        border: "1px solid #e5e7eb"
    },

    checkList: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "10px",
        maxHeight: "180px",
        overflowY: "auto"
    },

    checkItem: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px",
        borderRadius: "10px",
        background: "white",
        border: "1px solid #e5e7eb",
        cursor: "pointer"
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

    notSignedBadge: {
        display: "inline-block",
        padding: "6px 10px",
        borderRadius: "8px",
        background: "#fef3c7",
        color: "#92400e",
        fontSize: "13px",
        fontWeight: "bold"
    },

    correctionLabel: {
        marginTop: "6px",
        color: "#7c3aed",
        fontSize: "12px",
        fontWeight: "bold"
    },

    empty: {
        textAlign: "center",
        marginTop: "25px",
        color: "#6b7280"
    },

    modalOverlay: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
    },

    modal: {
        background: "white",
        padding: "28px",
        borderRadius: "18px",
        width: "700px",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 20px 40px rgba(0,0,0,0.25)"
    },

    modalText: {
        color: "#4b5563",
        marginBottom: "18px"
    },

    modalActions: {
        marginTop: "18px",
        display: "flex",
        gap: "10px"
    }
};

export default Dashboard;
