
import React, { useState } from 'react';
import { LoginForm } from './components/LoginForm';
import { AdminDashboard } from './components/AdminDashboard';
import { EmployeeCard } from './components/EmployeeCard';
import { UserSession } from './types';

function App() {
  const [session, setSession] = useState<UserSession | null>(null);

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
  };

  const handleLogout = () => {
    setSession(null);
  };

  if (!session) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  if (session.type === 'admin') {
    return <AdminDashboard onLogout={handleLogout} session={session} />;
  }

  if (session.type === 'employee' && session.employeeData) {
    return <EmployeeCard employee={session.employeeData} onLogout={handleLogout} />;
  }

  return <div>Loading...</div>;
}

export default App;
