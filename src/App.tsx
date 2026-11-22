import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { reporterRoles, type User } from '../shared/domain';
import { useAuth } from './auth';
import { Notifications } from './components/Notifications';
import { BrandLogo } from './components/BrandLogo';
import { ThemeToggle } from './components/ThemeToggle';
import { Admin } from './pages/Admin';
import { ChangePassword } from './pages/ChangePassword';
import { IncidentDetail } from './pages/IncidentDetail';
import { IncidentList } from './pages/IncidentList';
import { ImpactSimulator } from './pages/ImpactSimulator';
import { Login } from './pages/Login';
import { Management } from './pages/Management';
import { Overview } from './pages/Overview';
import { ReportIncident } from './pages/ReportIncident';

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="boot" role="status">Loading…</p>;
  if (!user) return <Login />;
  if (user.mustChangePassword) return <ChangePassword forced />;
  return <Shell user={user} />;
}

const roleLabel = (role: User['role']) => role === 'Manager' ? 'IT Manager' : role;

function Shell({ user }: { user: User }) {
  const { signOut } = useAuth();
  const reporter = reporterRoles.includes(user.role);
  return <>
    <header>
      <Link className="header-brand" to="/" aria-label="Bharat Rail ITSM — Home"><BrandLogo className="header-brand-logo" /></Link>
      <div className="header-actions">
        <ThemeToggle />
        <Notifications />
        <span className="who">{user.name}<small>{roleLabel(user.role)} · <Link to="/account" className="who-link">Change password</Link></small></span>
        <button className="header-button" onClick={() => void signOut()}>Sign out</button>
      </div>
    </header>
    <nav aria-label="Main navigation">
      <div className="nav-label">SERVICE OPERATIONS</div>
      <NavLink to="/" end>Overview</NavLink>
      <NavLink to="/incidents" end>{user.role === 'Technician' ? 'My assignments' : reporter ? 'My incidents' : 'Incidents'}</NavLink>
      {reporter && <NavLink to="/incidents/new">Report incident</NavLink>}
      {user.role === 'Manager' && <NavLink to="/management">Management</NavLink>}
      {user.role === 'Manager' && <NavLink to="/admin">Settings</NavLink>}
      {user.role === 'Manager' && <NavLink to="/impact-simulator">Impact simulator</NavLink>}
      <div className="nav-bottom">I-ITSM<br /><span>Internal service management</span></div>
    </nav>
    <main>
      <Routes>
        <Route path="/" element={<Overview user={user} />} />
        <Route path="/incidents" element={<IncidentList user={user} />} />
        <Route path="/incidents/new" element={reporter ? <ReportIncident /> : <p>Incidents are reported by employees and customers.</p>} />
        <Route path="/account" element={<ChangePassword />} />
        <Route path="/incidents/:id" element={<IncidentDetail user={user} />} />
        <Route path="/management" element={user.role === 'Manager' ? <Management /> : <p>This screen is for the IT manager.</p>} />
        <Route path="/admin" element={user.role === 'Manager' ? <Admin /> : <p>This screen is for the IT manager.</p>} />
        <Route path="/impact-simulator" element={user.role === 'Manager' ? <ImpactSimulator /> : <p>This screen is for the IT manager.</p>} />
        <Route path="*" element={<><h1>Page not found</h1><Link to="/">Return to overview</Link></>} />
      </Routes>
    </main>
    <footer>Bharat Rail · IT Service Management</footer>
  </>;
}
