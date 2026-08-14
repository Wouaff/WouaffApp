import AdminApp, { AdminProviders } from './admin/AdminApp';

export default function AdminPage() {
  return (
    <AdminProviders>
      <AdminApp />
    </AdminProviders>
  );
}
