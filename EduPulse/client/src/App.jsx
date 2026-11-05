import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import { Loading } from './lib/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Landing from './pages/Landing.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Attendance from './pages/Attendance.jsx';
import Marks from './pages/Marks.jsx';
import Performance from './pages/Performance.jsx';
import Extracurricular from './pages/Extracurricular.jsx';
import Feedback from './pages/Feedback.jsx';
import Results from './pages/Results.jsx';
import Fees from './pages/Fees.jsx';
import Reports from './pages/Reports.jsx';
import MissedCourses from './pages/MissedCourses.jsx';
import Notifications from './pages/Notifications.jsx';
import Profile from './pages/Profile.jsx';
import EarlyWarning from './pages/EarlyWarning.jsx';
import Students from './pages/Students.jsx';
import Admin from './pages/Admin.jsx';

const Guard = ({ roles, children }) => { const { user } = useAuth(); return roles && !roles.includes(user.role) ? <Navigate to="/dashboard" replace /> : children; };

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-screen bg-white"><Loading label="Starting EduPulse…" /></div>;
  if (!user) return (<Routes><Route path="/" element={<Landing />} /><Route path="/login" element={<Login />} /><Route path="/signup" element={<Signup />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>);
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/marks" element={<Marks />} />
        <Route path="/performance" element={<Performance />} />
        <Route path="/extracurricular" element={<Extracurricular />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/results" element={<Results />} />
        <Route path="/fees" element={<Fees />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/missed-courses" element={<MissedCourses />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/early-warning" element={<EarlyWarning />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/students" element={<Guard roles={['admin', 'teacher']}><Students /></Guard>} />
        <Route path="/students/:id" element={<Guard roles={['admin', 'teacher']}><Profile /></Guard>} />
        <Route path="/admin" element={<Guard roles={['admin']}><Admin /></Guard>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
