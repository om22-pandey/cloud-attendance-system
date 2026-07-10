const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');3
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(morgan('combined'));

const verifyTeacher = (req, res, next) => {
  try {
    // const token = req.headers.authorization?.split(" ")[1];
    const token = req.headers.authorization;

    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "teacher") {
      return res.status(403).json({ error: "Only teacher allowed" });
    }

    req.user = decoded; // optional
    next();

  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// Database connection (PostgreSQL/RDS)
const { Pool } = require('pg');
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});


// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
  } else {
    console.log('✓ Database connected successfully');
    release();
  }
});

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      database: 'connected',
      dbTime: result.rows[0].now
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      database: 'disconnected',
      error: error.message
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Cloud Attendance System API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      students: '/api/students',
      attendance: '/api/attendance',
      records: '/api/attendance/records'
    }
  });
});

// Register user (teacher/student)
app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING *',
      [email, hashedPassword, role]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await pool.query(
    'SELECT * FROM users WHERE email=$1',
    [email]
  );

  if (user.rows.length === 0) {
    return res.status(401).json({ error: "Invalid user" });
  }

  const valid = await bcrypt.compare(password, user.rows[0].password);

  if (!valid) return res.status(401).json({ error: "Wrong password" });

  const token = jwt.sign(
    { role: user.rows[0].role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }

  );

  res.json({
  token,
  user: {
    id: user.rows[0].id,
    email: user.rows[0].email,
    role: user.rows[0].role,
    name: user.rows[0].name || "User"
  }
  });
});

// Get all students
app.get('/api/students', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, student_id, created_at FROM students ORDER BY name'
    );
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch students',
      message: error.message
    });
  }
});

// Add new student
app.post('/api/students', async (req, res) => {
  const { name, email, student_id } = req.body;
  
  if (!name || !email || !student_id) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, email, student_id'
    });
  }

  try {
    const result = await pool.query(
      'INSERT INTO students (name, email, student_id) VALUES ($1, $2, $3) RETURNING *',
      [name, email, student_id]
    );
    res.status(201).json({
      success: true,
      message: 'Student added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding student:', error);
    if (error.code === '23505') { // Unique violation
      res.status(409).json({
        success: false,
        error: 'Student with this email or ID already exists'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to add student',
        message: error.message
      });
    }
  }
});

// Mark attendance
app.post('/api/attendance', verifyTeacher, async (req, res) => {
  const { student_id, status, date, notes } = req.body;
  
  if (!student_id || !status) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: student_id, status'
    });
  }

  const attendanceDate = date || new Date().toISOString().split('T')[0];

  try {
    // Check if student exists
    const studentCheck = await pool.query(
      'SELECT id FROM students WHERE student_id = $1',
      [student_id]
    );

    if (studentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Insert or update attendance
    const result = await pool.query(
      `INSERT INTO attendance (student_id, date, status, notes) 
       VALUES ((SELECT id FROM students WHERE student_id = $1), $2, $3, $4)
       ON CONFLICT (student_id, date) 
       DO UPDATE SET status = $3, notes = $4, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [student_id, attendanceDate, status, notes]
    );

    res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark attendance',
      message: error.message
    });
  }
});

// Get attendance records
app.get('/api/attendance/records', async (req, res) => {
  const { student_id, start_date, end_date, status, admin } = req.query;
  
  try {
    let query = `
      SELECT a.id, s.name, s.email, s.student_id, a.date, a.status, a.notes, a.created_at
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    
    if (student_id) {
      query += ` AND s.student_id = $${paramIndex}`;
      params.push(student_id);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND a.date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND a.date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (admin) {
      query += ` AND a.marked_by = $${paramIndex}`;
      params.push(admin);
      paramIndex++;
    }
    
    query += ' ORDER BY a.date DESC, s.name';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      filters: { student_id, start_date, end_date, status },
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching attendance records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attendance records',
      message: error.message
    });
  }
});

// Get attendance statistics
app.get('/api/attendance/stats', async (req, res) => {
  const { student_id, start_date, end_date } = req.query;
  
  try {
    let query = `
      SELECT 
        s.student_id,
        s.name,
        COUNT(*) FILTER (WHERE a.status = 'present') as present_count,
        COUNT(*) FILTER (WHERE a.status = 'absent') as absent_count,
        COUNT(*) FILTER (WHERE a.status = 'late') as late_count,
        COUNT(*) as total_records,
        ROUND(COUNT(*) FILTER (WHERE a.status = 'present')::numeric / NULLIF(COUNT(*), 0) * 100, 2) as attendance_percentage
      FROM students s
      LEFT JOIN attendance a ON s.id = a.student_id
      WHERE 1=1
      
    `;
    const params = [];
    let paramIndex = 1;
    
    if (student_id) {
      query += ` AND s.student_id = $${paramIndex}`;
      params.push(student_id);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND a.date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND a.date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    if (admin) {
      query += ` AND a.marked_by = $${paramIndex}`;
      params.push(admin);
      paramIndex++;
    }
    query += ' GROUP BY s.student_id, s.name ORDER BY s.name';

    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching attendance statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attendance statistics',
      message: error.message
    });
  }
});

app.post("/api/attendance/bulk", verifyTeacher, async (req, res) => {
  try {
    const { date, records } = req.body;

    if (!records || records.length === 0) {
      return res.json({ success: false, error: "No records provided" });
    }

    const attendanceDate = date || new Date().toISOString().split("T")[0];

    for (let r of records) {
      await pool.query(
      `INSERT INTO attendance (student_id, date, status, marked_by)
      VALUES (
        (SELECT id FROM students WHERE student_id = $1),
        $2,
        $3,
        $4
      )
      ON CONFLICT (student_id, date, marked_by)
      DO UPDATE SET status = $3`,
      [r.student_id, attendanceDate, r.status, req.user.id]
    );
    }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});
// new api for showing admins
app.get("/api/admins", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email 
      FROM users 
      WHERE role = 'teacher' 
      AND email LIKE 'admin%'
    `);

    res.json({ success: true, data: result.rows });

  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// new api for adding admins
app.post('/api/admins', async (req, res) => {
  try {
    const { name, email } = req.body;

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        name,
        email,
        '123456',   // default password
        'teacher'   // 🔥 admin = teacher in your system
      ]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  pool.end(() => {
    console.log('Database pool has ended');
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

module.exports = app;
