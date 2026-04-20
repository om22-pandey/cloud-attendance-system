import React, { useState, useEffect } from 'react';
import './App.css';
import profilePic from "./images/profile_pic.webp";

function App() {
  const [students, setStudents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));
  const [openDate, setOpenDate] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
  new Date().toISOString().split("T")[0]
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedAdmin, setSelectedAdmin] = useState("");
  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    role: "student"
  });
  let user = null;
  try {
    const data = localStorage.getItem("user");

    if (data && data !== "undefined") {
      user = JSON.parse(data);
    }
  } catch (err) {
    console.log("Invalid user in localStorage");
  }

  const [newAdmin, setNewAdmin] = useState({
  name: "",
  email: "",
  admin_id: ""
});

const isHeadAdmin = 
  user?.email === "admin.head@org.in";
  
  // Form states
  const [newStudent, setNewStudent] = useState({ name: '', email: '', student_id: '' });
  const [attendanceForm, setAttendanceForm] = useState({ student_id: '', status: 'present', date: '', notes: '' });
  const [filterDate, setFilterDate] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  const today = new Date().toLocaleDateString();

  const todayPresent = attendanceRecords.filter(r => {
    const recordDate = new Date(r.date).toLocaleDateString();
    return r.status === 'present' && recordDate === today;
  }).length;

  // Fetch students
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/students`);
      const data = await response.json();
      if (data.success) {
        setStudents(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch students: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

    const todayTotal = attendanceRecords.filter(r => {
    return new Date(r.date).toLocaleDateString() === today;
  }).length;

  // get records in table
  const groupByDate = (records) => {
  return records.reduce((acc, record) => {
    const date = new Date(record.date).toLocaleDateString();

    if (!acc[date]) {
      acc[date] = [];
    }

    acc[date].push(record);
    return acc;
  }, {});
};



const groupedRecords = groupByDate(attendanceRecords);

  // Fetch attendance records
  const fetchAttendanceRecords = async (date = '') => {
    try {
      setLoading(true);
      let url = `${API_BASE_URL}/api/attendance/records?`;
      if (date) {
        url += `start_date=${date}&end_date=${date}&`;
      }

      if (selectedAdmin) {
        url += `admin=${selectedAdmin}&`;
      }
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setAttendanceRecords(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch attendance records: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  fetchAttendanceRecords(selectedDate);
}, [selectedDate, selectedAdmin]);

  const handleAttendanceAccess = () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));

  if (!token) {
    alert("Please login first");
    setShowLogin(true);
    return;
  }

  if (user?.role !== "teacher") {
    alert("Only teacher can mark attendance ❌");
    return;
  }

  setActiveTab("attendance");
};

  // handle login
const handleLogin = async () => {
  try {
    const res = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPassword
      })
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      alert("Login successful");
      setShowLogin(false);
      setIsLoggedIn(true);
      // setActiveTab("attendance");
    } else {
      alert(data.error || "Login failed");
    }

  } catch (err) {
    console.error(err);
    alert("Error connecting to backend");
  }
};

// handle register
const handleRegister = async () => {
  try {
    const res = await fetch("http://localhost:5000/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(registerData)
    });

    const data = await res.json();

    if (data.success) {
      alert("Registered successfully! now login ");
      setShowRegister(false);
    } else {
      alert(data.error || "Registration failed");
    }
  } catch (err) {
    console.error(err);
    alert("Error connecting to backend");
  }
};
  //handle attendence access
//   const handleAttendanceAccess = () => {
//   const token = localStorage.getItem("token");

//   if (!token) {
//     alert("Please login first");
//     setShowLogin(true);
//     return;
//   }

//   setActiveTab("attendance");
// };

const handleStudentsAccess = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first");
    setShowLogin(true);   // 🔥 login form open
    return;
  }

  setActiveTab("students"); // ✅ open students page
};

const filteredRecords = attendanceRecords.filter(record => {

  const recordDate = new Date(record.date).toLocaleDateString();
  const selected = selectedDate 
    ? new Date(selectedDate).toLocaleDateString() 
    : null;

  // date filter
  if (selected && recordDate !== selected) return false;

  // status filter
  if (statusFilter !== "all" && record.status !== statusFilter) return false;

  return true;
});

  // Add new student
  const handleAddStudent = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token"); // 🔑 get token

    if (!token) {
      alert("Please login first");
      // setShowLogin(true);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStudent) 
      });
      const data = await response.json();
      if (data.success) {
        setNewStudent({ name: '', email: '', student_id: '' });
        fetchStudents();
        alert('Student added successfully!');
        console.log("Sending:", newStudent);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to add student: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStats = (records) => {
  let present = 0, absent = 0, late = 0;

  records.forEach(r => {
    if (r.status === "present") present++;
    else if (r.status === "absent") absent++;
    else if (r.status === "late") late++;
  });

  return { present, absent, late, total: records.length };
};

const todayRecords = attendanceRecords.filter(r => {
  return new Date(r.date).toLocaleDateString() === today;
});

const stats = getStats(filteredRecords);

  // mark attendence
 const handleMarkAttendance = async (e) => {
  e.preventDefault();

  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please login first");
    return;
  }

  try {
    setLoading(true);
    setError(null);

    const response = await fetch(`${API_BASE_URL}/api/attendance/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token
      },
      body: JSON.stringify({
        date: attendanceForm.date || new Date().toISOString().split("T")[0],
        records: attendanceList
      })
    });

    const data = await response.json();

    if (data.success) {
      alert("Attendance marked for all students ✅");
      fetchAttendanceRecords();
    } else {
      setError(data.error || "Something went wrong");
    }

  } catch (err) {
    setError("Error: " + err.message);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchStudents();
    fetchAttendanceRecords();
  }, []);

  useEffect(() => {
  const initialList = students.map(student => ({
    student_id: student.student_id,
    name: student.name,
    status: "present",
    notes: ""
  }));

  setAttendanceList(initialList);
}, [students]);

  useEffect(() => {
  if (activeTab !== "attendance") {
    setIsAuthenticated(false);
  }
}, [activeTab]);

const fetchAdmins = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admins`);
    const data = await res.json();

    if (data.success) {
      setAdmins(data.data);
    }
  } catch (err) {
    console.error(err);
  }
};

useEffect(() => {
  fetchStudents();
  fetchAttendanceRecords();
  fetchAdmins();   // 🔥 ADD THIS
}, []);

const handleAddAdmin = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/admins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newAdmin)
    });

    const data = await response.json();

    if (data.success) {
      alert("Admin added successfully ✅");

      fetchAdmins();   // refresh list

      setNewAdmin({
        name: "",
        email: "",
        admin_id: ""
      });

    } else {
      alert(data.error);
    }

  } catch (err) {
    console.error(err);
    alert("Error adding admin");
  }
};

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className='heading'>
            <div className="personal_info">
              <img src={profilePic} alt="profile" />

              {user && (
                <div className="user-details">
                  <h4>{user.name}</h4>
                  <p>{user.email}</p>
                  <p>{user.role}</p>
                </div>
              )}
            </div>
            <div className="center_text">
              <h1>☁️ Cloud Attendance System</h1>
              <p>Attendance Tracking Made Simple</p>

            </div>
            <div className="auth-buttons">
            {/* {isHeadAdmin && (
              <button onClick={() => {
                setShowRegister(true);
                setShowLogin(false);
              }}>
                Register
              </button>
            )} */}
            <button onClick={() => {
              setShowRegister(true);
              setShowLogin(false);
            }}>
              Register
            </button>
              {!localStorage.getItem("token") ? (
                <button onClick={() =>{ setShowLogin(true); setShowRegister(false)}}>Login</button>
                
                
              ) : (
                <button onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("user");
                  setIsLoggedIn(false);
                  setActiveTab("dashboard");
                }}>
                  Logout
                </button>
              )}
            </div>
          </div>

        </div>
      </header>
      
      {showRegister &&  (
        <div className="form">
          <input 
            type="email"
            placeholder="Email"
            onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
          />

          <input 
            type="password"
            placeholder="Password"
            onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
          />

          <select
            value={registerData.role}   // 🔥 ADD THIS LINE
            onChange={(e) => setRegisterData({
              ...registerData,
              role: e.target.value
            })}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>

          <button onClick={handleRegister}>
            Register
          </button>

          <button onClick={() => setShowRegister(false)}>
            Cancel
          </button>
          <p onClick={() => { setShowRegister(false); setShowLogin(true); }}>
            Already have an account? Login
          </p>
        </div>
      )}

      {showLogin && (
        <div className="form">
          <input 
            type="email" 
            placeholder="Email" 
            onChange={(e) => setLoginEmail(e.target.value)} 
          />

          <input 
            type="password" 
            placeholder="Password" 
            onChange={(e) => setLoginPassword(e.target.value)} 
          />

          <button onClick={handleLogin}>
            Login
          </button>


          {/* close button */}
          <button onClick={() => setShowLogin(false)}>
            Cancel
          </button>

          <p onClick={() => { setShowLogin(false); setShowRegister(true); }}>
            Don't have an account? Register
          </p>
        </div>
      )}

      {/* navbar */}  
      <nav className="tabs">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''} 
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={activeTab === 'students' ? 'active' : ''} 
          onClick={handleStudentsAccess}
        >
          System Management
        </button>
        {user?.role === "teacher" && (
          <button 
            className={activeTab === 'attendance' ? 'active' : ''} 
            onClick={handleAttendanceAccess}
          >
            Mark Attendance
          </button>
        )}
        <button 
          className={activeTab === 'records' ? 'active' : ''} 
          onClick={() => setActiveTab('records')}
        >
          View Records
        </button>

        {/* <button onClick={() => setShowLogin(true)}>
          Login
        </button>

        <button onClick={() => {
          localStorage.removeItem("token");
          alert("Logged out");
        }}>
          Logout
        </button> */}
      </nav>

      <main className="container">
        {error && <div className="error-message">{error}</div>}
        {loading && <div className="loading">Loading...</div>}

        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <h2>Welcome to Cloud Attendance System</h2>
            <p>Track attendance efficiently with our cloud-based solution.</p>
            <div className="stats">
              <div className="stat-card">
                <h3>{students.length}</h3>
                <p>Total Students</p>
              </div>
              <div className="stat-card">
                <h3>{todayTotal}</h3>
                <p>Attendance Records</p>
              </div>
              <div className="stat-card">
                <h3>{todayPresent}</h3>
                <p>Present Today</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="admin-panel">
            <h2>System Management</h2>
            {isHeadAdmin && (
              <div className="forms-row">
                {/* STUDENT FORM */}
                <div className="card">
                  <h3>Add New Student</h3>
                  <input 
                    placeholder="Student Name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                  />
                  <input 
                    placeholder="Email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                  />
                  <input 
                    placeholder="Student ID"
                    value={newStudent.student_id}
                    onChange={(e) => setNewStudent({...newStudent, student_id: e.target.value})}
                  />
                  <button onClick={(e) => handleAddStudent(e)}>Add Student</button>
                </div>

                {/* ADMIN FORM */}
                <div className="card">
                  <h3>Add New Admin</h3>
                  <input
                    placeholder="Admin Name"
                    value={newAdmin.name}
                    onChange={(e) => setNewAdmin({...newAdmin, name: e.target.value})}
                  />

                  <input
                    placeholder="Admin Email"
                    value={newAdmin.email}
                    onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                  />

                  <input
                    placeholder="Admin ID"
                    value={newAdmin.admin_id}
                    onChange={(e) => setNewAdmin({...newAdmin, admin_id: e.target.value})}
                  />
                  <button onClick={handleAddAdmin}>Add Admin</button>
                </div>
              </div>
            )}
            <div className="lists-row">

              {/* STUDENT LIST */}
              <div className="list-card">
                <h3>Student List</h3>
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => (
                      <tr key={s.id}>
                        <td>{s.student_id}</td>
                        <td>{s.name}</td>
                        <td>{s.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ADMIN LIST */}
              <div className="list-card">
                <h3>Admin List</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((admin, index) => (
                      <tr key={index}>
                        <td>{admin.name}</td>
                        <td>{admin.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

          </div>

        )}

        {activeTab === 'attendance' &&(
          <div className="attendance-section">
            {/* <div className="attendance-card"> */}
            <h2>Mark Attendance</h2>
            <form onSubmit={handleMarkAttendance} className="attendance-form">
              <table>
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {attendanceList.map((student, index) => (
                    <tr key={student.student_id}>
                      <td>{student.student_id}</td>
                      <td>{student.name}</td>

                      <td>
                        <select
                          value={student.status}
                          onChange={(e) => {
                            const updated = [...attendanceList];
                            updated[index].status = e.target.value;
                            setAttendanceList(updated);
                          }}
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="late">Late</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <input
                type="date"
                value={attendanceForm.date}
                onChange={(e) => setAttendanceForm({...attendanceForm, date: e.target.value})}
              />

              <button type="submit">Mark Attendance</button>
            </form>
            {/* </div> */}
          </div>
        )}

        {activeTab === 'records' && (
          <div className="records-dark">

            {/* HEADER */}
            <div className="records-header">
              <div className="filters">
                {/* DATE FILTER */}
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />

                <select
                  value={selectedAdmin}
                  onChange={(e) => setSelectedAdmin(e.target.value)}
                >
                  <option value="">All Admins</option>
                  {admins.map((a, index) => (
                    <option key={index} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>

                {/* STATUS FILTER */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                </select>

                {/* CLEAR BUTTON */}
                <button onClick={() => {
                  setSelectedDate("");
                  setStatusFilter("all");
                }}>
                  Clear Filters
                </button>

              </div>
              <h2>Attendance Records</h2>

              <div className="stats-row">
                <div>Showing <b>{stats.total}</b></div>
                <div>Present <b>{stats.present}</b></div>
                <div>Absent <b>{stats.absent}</b></div>
                <div>Late <b>{stats.late}</b></div>
              </div>
            </div>

            {/* TABLE */}
            <div className="records-table">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecords.map(record => (
                    <tr key={record.id}>
                      <td>
                        <div className="student-info">
                          <strong>{record.name}</strong>
                          <span>{record.student_id}</span>
                        </div>
                      </td>

                      <td>
                        {new Date(record.date).toLocaleDateString()}
                      </td>

                      <td>
                        <span className={`badge ${record.status}`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </main>

      <footer className="footer">
        <p>&copy; 2026 Cloud Attendance System. Built with React & AWS.</p>
      </footer>
    </div>
  );
}

export default App;
