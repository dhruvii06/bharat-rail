import { Link, NavLink, Route, Routes } from 'react-router-dom';
import type { User } from '../shared/domain';
import { useAuth } from './auth';
import { Notifications } from './components/Notifications';
import { IncidentDetail } from './pages/IncidentDetail';
import { IncidentList } from './pages/IncidentList';
import { Login } from './pages/Login';
import { Management } from './pages/Management';
import { Overview } from './pages/Overview';
import { ReportIncident } from './pages/ReportIncident';

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="boot" role="status">Loading…</p>;
  if (!user) return <Login />;
  return <Shell user={user} />;
}

function Shell({ user }: { user: User }) {
  const { signOut } = useAuth();
  return <>
    <header>
      <div><strong>Bharat Rail (BR) <span className="brand-divider">/</span> Incident Desk</strong></div>
      <div className="header-actions">
        <Notifications />
        <span className="who">{user.name}<small>{user.role === 'Manager' ? 'IT Manager' : user.role}</small></span>
        <button className="header-button" onClick={() => void signOut()}>Sign out</button>
      </div>
    </header>
    <nav aria-label="Main navigation">
      <div className="nav-label">SERVICE OPERATIONS</div>
      <NavLink to="/" end>Overview</NavLink>
      <NavLink to="/incidents" end>{user.role === 'Technician' ? 'My assignments' : user.role === 'Employee' ? 'My incidents' : 'Incidents'}</NavLink>
      {user.role === 'Employee' && <NavLink to="/incidents/new">Report incident</NavLink>}
      {user.role === 'Manager' && <NavLink to="/management">Management</NavLink>}
      <div className="nav-bottom">I-ITSM<br /><span>Internal service management</span></div>
    </nav>
    <main>
      <Routes>
        <Route path="/" element={<Overview user={user} />} />
        <Route path="/incidents" element={<IncidentList user={user} />} />
        <Route path="/incidents/new" element={user.role === 'Employee' ? <ReportIncident /> : <p>Only employees report incidents.</p>} />
        <Route path="/incidents/:id" element={<IncidentDetail user={user} />} />
        <Route path="/management" element={user.role === 'Manager' ? <Management /> : <p>This screen is for the IT manager.</p>} />
        <Route path="*" element={<><h1>Page not found</h1><Link to="/">Return to overview</Link></>} />
      </Routes>
    </main>
    <footer>Bharat Rail · IT Service Management</footer>
  </>;
}
