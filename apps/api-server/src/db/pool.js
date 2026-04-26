import mysql from 'mysql2/promise';
import config from '../config.js';

const pool = mysql.createPool({
  ...config.mysql,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
