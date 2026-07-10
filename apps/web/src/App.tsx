import { Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import SessionFlow from './pages/session/SessionFlow';
import ReportPage from './pages/session/ReportPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import SessionDetailPage from './pages/admin/SessionDetailPage';
import QuestionnairesPage from './pages/admin/QuestionnairesPage';
import QuestionnaireEditor from './pages/admin/QuestionnaireEditor';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/join/:pin" element={<Home />} />
      <Route path="/session" element={<SessionFlow />} />
      <Route path="/session/report" element={<ReportPage />} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="sessions/:id" element={<SessionDetailPage />} />
        <Route path="questionnaires" element={<QuestionnairesPage />} />
        <Route path="questionnaires/versions/:versionId" element={<QuestionnaireEditor />} />
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
