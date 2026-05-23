const fs = require("fs");
const mysql = require("mysql2/promise");

async function importDatabase() {
    try {
        const sql = fs.readFileSync("secure_docflow.sql", "utf8");

        const connection = await mysql.createConnection({
            host: "kodama.proxy.rlwy.net",
            port: 40623,
            user: "root",
            password: "ZcPPufNoHcFXQlLIweYNCrgseBDvaRIw",
            database: "railway",
            multipleStatements: true
        });

        console.log("Подключение успешно");

        await connection.query(sql);

        console.log("База данных импортирована");

        await connection.end();

    } catch (error) {
        console.error(error);
    }
}

importDatabase();