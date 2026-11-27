import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import {
  ArrowUpRight, BookOpen, Clock3, Cross, FileText, LogOut, MapPin, Phone,
  Search, Settings, ShieldCheck, Stethoscope, UserRound, X
} from 'lucide-react';
import { api } from './api.js';

const weekdays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const facilityStatuses = ['Aktif', 'Tidak Aktif', 'Perlu Verifikasi'];
const defaultSiteSettings = {
  website_name: 'SehatDekat',
  tagline: 'Layanan kesehatan lebih dekat',
  homepage_description: 'Temukan fasilitas kesehatan, layanan, informasi, dan artikel kesehatan di sekitar Anda.',
  whatsapp_number: '081373418699'
};
const emptyFacility = {
  facility_name: '', facility_type: 'Puskesmas', address: '', phone_number: '',
  status: 'Perlu Verifikasi', latitude: '', longitude: ''
};
const emptyContent = {
  content_type: 'informasi', title: '', summary: '', body: '', is_published: true
};
const emptyUser = { full_name: '', email: '', password: '', role: 'masyarakat' };

function getTodayHours(hours = [], exceptions = []) {
  const day = new Date().getDay();
  const isoDay = day === 0 ? 7 : day;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const special = exceptions.filter((item) => item.exception_date === todayKey);
  const rows = special.length ? special : hours.filter((hour) => hour.day_of_week === isoDay);
  if (!rows.length || rows.every((hour) => hour.is_closed)) return 'Tutup hari ini';
  return rows.filter((hour) => !hour.is_closed)
    .map((hour) => `${hour.opens_at}–${hour.closes_at}`).join(' · ');
}

function statusStyle(status) {
  if (status === 'Aktif') return 'badge badge-green';
  if (status === 'Tidak Aktif') return 'badge badge-gray';
  return 'badge badge-amber';
}

function getWhatsAppHref(number) {
  const digits = number.replace(/\D/g, '');
  const international = digits.startsWith('0') ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${international}?text=${encodeURIComponent('Halo, saya ingin bertanya tentang informasi layanan kesehatan.')}`;
}

function App() {
  const [page, setPage] = useState('public');
  const [adminTab, setAdminTab] = useState('facilities');
  const [facilities, setFacilities] = useState([]);
  const [healthServices, setHealthServices] = useState([]);
  const [publicContents, setPublicContents] = useState([]);
  const [siteSettings, setSiteSettings] = useState(defaultSiteSettings);
  const [activeContent, setActiveContent] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedFacilities, setHasLoadedFacilities] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('admin-token') || '');
  const [login, setLogin] = useState({ email: '', password: '' });
  const [facilityForm, setFacilityForm] = useState(emptyFacility);
  const [editingId, setEditingId] = useState(null);
  const [servicesText, setServicesText] = useState('');
  const [schedule, setSchedule] = useState(() => weekdays.map((_, i) => ({
    day_of_week: i + 1, slots: []
  })));
  const [exceptionForm, setExceptionForm] = useState({
    exception_date: '', is_closed: true, opens_at: '08:00', closes_at: '12:00', note: ''
  });
  const [adminContents, setAdminContents] = useState([]);
  const [contentForm, setContentForm] = useState(emptyContent);
  const [editingContentId, setEditingContentId] = useState(null);
  const [users, setUsers] = useState([]);
  const [userForm, setUserForm] = useState(emptyUser);
  const [editingUserId, setEditingUserId] = useState(null);
  const [adminSettings, setAdminSettings] = useState(defaultSiteSettings);
  const facilitiesRequest = useRef(null);
  const selectedRequest = useRef(null);

  const filters = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (service.trim()) params.set('service', service.trim());
    return params.toString();
  }, [debouncedSearch, type, status, service]);

  const loadFacilities = useCallback(async () => {
    facilitiesRequest.current?.abort();
    const controller = new AbortController();
    facilitiesRequest.current = controller;
    setLoading(true);
    setError('');
    try {
      const data = await api(`/facilities${filters ? `?${filters}` : ''}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setFacilities(data);
      if (!filters) setFacilityTypes([...new Set(data.map((item) => item.facility_type))]);
      setSelectedId((current) => data.some((item) => item.facility_id === current)
        ? current : data[0]?.facility_id || null);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setHasLoadedFacilities(true);
      }
    }
  }, [filters]);

  const loadSelected = useCallback(async (id) => {
    selectedRequest.current?.abort();
    if (!id) {
      setSelected(null);
      return;
    }
    const controller = new AbortController();
    selectedRequest.current = controller;
    try {
      const data = await api(`/facilities/${id}`, { signal: controller.signal });
      if (!controller.signal.aborted) setSelected(data);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    loadFacilities();
    return () => facilitiesRequest.current?.abort();
  }, [loadFacilities]);
  useEffect(() => {
    loadSelected(selectedId);
    return () => selectedRequest.current?.abort();
  }, [selectedId, loadSelected]);
  useEffect(() => {
    Promise.all([api('/services'), api('/content'), api('/site-settings')])
      .then(([serviceRows, contentRows, settings]) => {
        setHealthServices(serviceRows);
        setPublicContents(contentRows);
        setSiteSettings(settings);
        setAdminSettings(settings);
      })
      .catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    if (page !== 'admin' || !token) return;
    if (adminTab === 'users') {
      api('/admin/users', { token }).then(setUsers).catch((err) => setError(err.message));
    } else if (adminTab === 'content') {
      api('/admin/content', { token }).then(setAdminContents).catch((err) => setError(err.message));
    } else if (adminTab === 'settings') {
      api('/site-settings').then((settings) => {
        setAdminSettings(settings);
        setSiteSettings(settings);
      }).catch((err) => setError(err.message));
    }
  }, [adminTab, page, token]);

  function showMessage(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }

  async function submitLogin(event) {
    event.preventDefault();
    setError('');
    try {
      const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(login) });
      localStorage.setItem('admin-token', result.token);
      setToken(result.token);
      setLogin({ email: '', password: '' });
      setPage('admin');
      setAdminTab('facilities');
      showMessage(`Selamat datang, ${result.user.name}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  function startCreate() {
    setFacilityForm(emptyFacility);
    setEditingId(null);
    setServicesText('');
    setSchedule(weekdays.map((_, i) => ({ day_of_week: i + 1, slots: [] })));
    setAdminTab('facilities');
    setPage('admin');
  }

  async function startEdit(facility) {
    setError('');
    let detail = facility;
    try {
      detail = await api(`/facilities/${facility.facility_id}`);
      setSelectedId(facility.facility_id);
      setSelected(detail);
    } catch (err) {
      setError(err.message);
      return;
    }
    setFacilityForm({
      facility_name: detail.facility_name,
      facility_type: detail.facility_type,
      address: detail.address,
      phone_number: detail.phone_number || '',
      status: detail.status,
      latitude: detail.latitude,
      longitude: detail.longitude
    });
    setEditingId(detail.facility_id);
    setServicesText((detail.services || []).map((item) =>
      `${item.service_name}${item.description ? ` | ${item.description}` : ''}`).join('\n'));
    setSchedule(weekdays.map((_, i) => {
      const rows = (detail.hours || []).filter((hour) => hour.day_of_week === i + 1);
      return {
        day_of_week: i + 1,
        slots: rows.filter((hour) => !hour.is_closed)
          .map((hour) => ({ opens_at: hour.opens_at, closes_at: hour.closes_at }))
      };
    }));
    setPage('admin');
  }

  async function saveFacility(event) {
    event.preventDefault();
    setError('');
    try {
      const payload = {
        ...facilityForm,
        latitude: Number(facilityForm.latitude),
        longitude: Number(facilityForm.longitude),
        phone_number: facilityForm.phone_number || null
      };
      const saved = await api(editingId ? `/admin/facilities/${editingId}` : '/admin/facilities', {
        method: editingId ? 'PUT' : 'POST',
        token,
        body: JSON.stringify(payload)
      });
      setFacilityTypes((current) => [...new Set([...current, saved.facility_type])]);
      const serviceRows = servicesText.split('\n').map((line) => {
        const [service_name, ...description] = line.split('|');
        return { service_name: service_name.trim(), description: description.join('|').trim() || null };
      }).filter((item) => item.service_name);
      await api(`/admin/facilities/${saved.facility_id}/services`, {
        method: 'PUT', token, body: JSON.stringify(serviceRows)
      });
      const hours = schedule.flatMap((item) => item.slots.length
        ? item.slots.map((slot, index) => ({
          day_of_week: item.day_of_week,
          slot_number: index + 1,
          opens_at: slot.opens_at,
          closes_at: slot.closes_at,
          is_closed: false
        }))
        : [{
          day_of_week: item.day_of_week,
          slot_number: 1,
          opens_at: null,
          closes_at: null,
          is_closed: true
        }]);
      await api(`/admin/facilities/${saved.facility_id}/hours`, {
        method: 'PUT', token, body: JSON.stringify(hours)
      });
      await loadFacilities();
      setHealthServices(await api('/services'));
      setSelectedId(saved.facility_id);
      await loadSelected(saved.facility_id);
      showMessage(editingId ? 'Informasi fasilitas diperbarui.' : 'Fasilitas baru ditambahkan.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeFacility(facility) {
    if (!window.confirm(`Hapus ${facility.facility_name}? Layanan dan jadwalnya juga akan dihapus.`)) return;
    try {
      await api(`/admin/facilities/${facility.facility_id}`, { method: 'DELETE', token });
      await loadFacilities();
      setHealthServices(await api('/services'));
      setSelected(null);
      showMessage('Fasilitas berhasil dihapus.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function addException(event) {
    event.preventDefault();
    if (!selected) return;
    try {
      await api(`/admin/facilities/${selected.facility_id}/exceptions`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          ...exceptionForm,
          slot_number: 1,
          opens_at: exceptionForm.is_closed ? null : exceptionForm.opens_at,
          closes_at: exceptionForm.is_closed ? null : exceptionForm.closes_at
        })
      });
      await loadSelected(selected.facility_id);
      setExceptionForm({ exception_date: '', is_closed: true, opens_at: '08:00', closes_at: '12:00', note: '' });
      showMessage('Perubahan tanggal khusus disimpan.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteException(exceptionId) {
    try {
      await api(`/admin/facilities/${selected.facility_id}/exceptions/${exceptionId}`, { method: 'DELETE', token });
      await loadSelected(selected.facility_id);
      showMessage('Pengecualian dihapus.');
    } catch (err) {
      setError(err.message);
    }
  }

  function startCreateContent() {
    setContentForm(emptyContent);
    setEditingContentId(null);
  }

  function startEditContent(content) {
    setContentForm({
      content_type: content.content_type,
      title: content.title,
      summary: content.summary,
      body: content.body,
      is_published: Boolean(content.is_published)
    });
    setEditingContentId(content.content_id);
  }

  async function saveContent(event) {
    event.preventDefault();
    setError('');
    try {
      const saved = await api(editingContentId
        ? `/admin/content/${editingContentId}` : '/admin/content', {
        method: editingContentId ? 'PUT' : 'POST',
        token,
        body: JSON.stringify(contentForm)
      });
      setAdminContents(await api('/admin/content', { token }));
      setPublicContents(await api('/content'));
      startEditContent(saved);
      showMessage(editingContentId ? 'Konten berhasil diperbarui.' : 'Konten baru berhasil ditambahkan.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeContent(content) {
    if (!content) return;
    if (!window.confirm(`Hapus konten "${content.title}"?`)) return;
    try {
      await api(`/admin/content/${content.content_id}`, { method: 'DELETE', token });
      setAdminContents(await api('/admin/content', { token }));
      setPublicContents(await api('/content'));
      startCreateContent();
      showMessage('Konten berhasil dihapus.');
    } catch (err) {
      setError(err.message);
    }
  }

  function startCreateUser() {
    setUserForm(emptyUser);
    setEditingUserId(null);
  }

  function startEditUser(user) {
    setUserForm({
      full_name: user.full_name,
      email: user.email,
      password: '',
      role: user.role
    });
    setEditingUserId(user.user_id);
  }

  async function saveUser(event) {
    event.preventDefault();
    setError('');
    try {
      const payload = { ...userForm };
      if (editingUserId && !payload.password) delete payload.password;
      const saved = await api(editingUserId
        ? `/admin/users/${editingUserId}` : '/admin/users', {
        method: editingUserId ? 'PUT' : 'POST',
        token,
        body: JSON.stringify(payload)
      });
      setUsers(await api('/admin/users', { token }));
      startEditUser(saved);
      showMessage(editingUserId ? 'Pengguna berhasil diperbarui.' : 'Pengguna baru berhasil ditambahkan.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeUser(user) {
    if (!user) return;
    if (!window.confirm(`Hapus akun ${user.full_name} (${user.email})?`)) return;
    try {
      await api(`/admin/users/${user.user_id}`, { method: 'DELETE', token });
      setUsers(await api('/admin/users', { token }));
      if (editingUserId === user.user_id) startCreateUser();
      showMessage('Akun pengguna berhasil dihapus.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveSiteSettings(event) {
    event.preventDefault();
    setError('');
    try {
      const saved = await api('/admin/site-settings', {
        method: 'PUT',
        token,
        body: JSON.stringify(adminSettings)
      });
      setAdminSettings(saved);
      setSiteSettings(saved);
      showMessage('Pengaturan website berhasil disimpan.');
    } catch (err) {
      setError(err.message);
    }
  }

  function signOut() {
    localStorage.removeItem('admin-token');
    setToken('');
    setPage('public');
    setAdminTab('facilities');
    showMessage('Anda telah keluar dari sesi admin.');
  }

  const coordinates = facilities
    .filter((facility) => Number.isFinite(Number(facility.latitude)) && Number.isFinite(Number(facility.longitude)));
  const mapCenter = selected
    ? [Number(selected.latitude), Number(selected.longitude)]
    : coordinates.length
      ? [Number(coordinates[0].latitude), Number(coordinates[0].longitude)]
      : [-2.1316, 106.109];

  return (
    <div className="min-h-screen">
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('public'); }}>
            <span className="brand-mark"><Cross size={23} strokeWidth={3} /></span>
            <span>{siteSettings.website_name}</span>
          </a>
          {page === 'public' && <nav className="site-nav" aria-label="Navigasi beranda">
            <a href="#cari">Fasilitas</a>
            <a href="#layanan">Layanan</a>
            <a href="#informasi">Informasi</a>
            <a href="#artikel">Artikel</a>
          </nav>}
          <div className="header-actions">
            <span className="header-caption"><span className="live-dot" /> {siteSettings.tagline.toUpperCase()}</span>
            {token ? (
              <div className="header-actions">
                <button className="button button-outline" onClick={() => setPage('admin')}><ShieldCheck size={17} /> Dashboard</button>
                <button className="button button-outline" onClick={signOut}><LogOut size={17} /> Keluar</button>
              </div>
            ) : (
              <button className="button button-dark" onClick={() => setPage(page === 'login' ? 'public' : 'login')}>
                <ShieldCheck size={17} /> Admin
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        {page === 'login' && !token ? (
          <section className="login-wrap container">
            <form className="login-card" onSubmit={submitLogin}>
              <span className="eyebrow">AREA ADMIN</span>
              <h1>Masuk untuk<br /><span className="text-blue">mengelola info.</span></h1>
              <p>Gunakan akun admin yang sudah disiapkan untuk memperbarui informasi fasilitas.</p>
              {error && <div className="alert">{error}</div>}
              <label>Email admin<input type="email" autoComplete="username" required value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} /></label>
              <label>Kata sandi<input type="password" autoComplete="current-password" required value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} /></label>
              <button className="button button-primary full-button">Masuk dashboard <ArrowUpRight size={18} /></button>
              <button type="button" className="text-button" onClick={() => { setPage('public'); setError(''); }}>Kembali ke informasi fasilitas</button>
            </form>
          </section>
        ) : page === 'admin' && token ? (
          <section className="container admin-layout">
            <div className="admin-heading">
              <div><span className="eyebrow">PANEL PENGELOLAAN</span><h1>Kelola informasi<span className="text-blue">.</span></h1></div>
              {adminTab === 'facilities' && <button className="button button-primary" onClick={startCreate}><Cross size={17} /> Tambah fasilitas</button>}
              {adminTab === 'content' && <button className="button button-primary" onClick={startCreateContent}><FileText size={17} /> Tambah konten</button>}
              {adminTab === 'users' && <button className="button button-primary" onClick={startCreateUser}><UserRound size={17} /> Tambah pengguna</button>}
            </div>
            {error && <div className="alert">{error}</div>}
            <nav className="admin-tabs" aria-label="Menu dashboard">
              <button className={adminTab === 'facilities' ? 'active' : ''} onClick={() => setAdminTab('facilities')}><Stethoscope size={17} /> Fasilitas</button>
              <button className={adminTab === 'content' ? 'active' : ''} onClick={() => setAdminTab('content')}><FileText size={17} /> Konten kesehatan</button>
              <button className={adminTab === 'users' ? 'active' : ''} onClick={() => setAdminTab('users')}><UserRound size={17} /> Pengguna</button>
              <button className={adminTab === 'settings' ? 'active' : ''} onClick={() => setAdminTab('settings')}><Settings size={17} /> Pengaturan website</button>
            </nav>
            {adminTab === 'facilities' && <div className="admin-grid">
              <aside className="admin-list card">
                <h2>Fasilitas tersimpan <span className="count-pill">{facilities.length}</span></h2>
                {facilities.map((facility) => (
                  <button key={facility.facility_id} className={`admin-row ${editingId === facility.facility_id ? 'active' : ''}`} onClick={() => startEdit(facility)}>
                    <span><b>{facility.facility_name}</b><small>{facility.facility_type}</small></span><ArrowUpRight size={16} />
                  </button>
                ))}
                {!facilities.length && <p className="muted">Belum ada data fasilitas.</p>}
              </aside>
              <div className="card admin-form-card">
                <form onSubmit={saveFacility}>
                  <div className="form-heading"><div><span className="eyebrow">{editingId ? 'EDIT DATA' : 'DATA BARU'}</span><h2>{editingId ? 'Perbarui fasilitas' : 'Tambah fasilitas'}</h2></div>
                    {editingId && <button type="button" className="button button-danger" onClick={() => removeFacility(selected || { facility_id: editingId, facility_name: facilityForm.facility_name })}>Hapus</button>}
                  </div>
                  <div className="form-grid">
                    <label className="wide">Nama fasilitas<input required maxLength="150" value={facilityForm.facility_name} onChange={(e) => setFacilityForm({ ...facilityForm, facility_name: e.target.value })} /></label>
                    <label>Jenis fasilitas<input required maxLength="50" placeholder="Puskesmas, klinik..." value={facilityForm.facility_type} onChange={(e) => setFacilityForm({ ...facilityForm, facility_type: e.target.value })} /></label>
                    <label>Status<select value={facilityForm.status} onChange={(e) => setFacilityForm({ ...facilityForm, status: e.target.value })}>{['Aktif', 'Tidak Aktif', 'Perlu Verifikasi'].map((value) => <option key={value}>{value}</option>)}</select></label>
                    <label className="wide">Alamat<textarea required rows="2" value={facilityForm.address} onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })} /></label>
                    <label>Telepon<input maxLength="20" value={facilityForm.phone_number} onChange={(e) => setFacilityForm({ ...facilityForm, phone_number: e.target.value })} /></label>
                    <label>Latitude<input required type="number" step="any" min="-90" max="90" value={facilityForm.latitude} onChange={(e) => setFacilityForm({ ...facilityForm, latitude: e.target.value })} /></label>
                    <label>Longitude<input required type="number" step="any" min="-180" max="180" value={facilityForm.longitude} onChange={(e) => setFacilityForm({ ...facilityForm, longitude: e.target.value })} /></label>
                  </div>
                  <label className="section-label">Layanan <small>Satu layanan per baris, deskripsi opsional setelah tanda |</small>
                    <textarea rows="3" placeholder={'Pemeriksaan umum | Konsultasi kesehatan dasar'} value={servicesText} onChange={(e) => setServicesText(e.target.value)} />
                  </label>
                  <div className="section-label">Jam operasional mingguan</div>
                  <div className="schedule-editor">
                    {schedule.map((item, index) => (
                        <div className="schedule-day" key={item.day_of_week}>
                          <div className="schedule-day-head"><b>{weekdays[index]}</b><span>{item.slots.length ? '' : 'Tutup'}</span><button type="button" disabled={item.slots.length >= 4} onClick={() => setSchedule(schedule.map((day, i) => i === index ? { ...day, slots: [...day.slots, { opens_at: '08:00', closes_at: '16:00' }] } : day))}>+ Sesi</button></div>
                          {item.slots.map((slot, slotIndex) => <div className="schedule-slot" key={`${item.day_of_week}-${slotIndex}`}>
                            <small>Sesi {slotIndex + 1}</small>
                            <input aria-label={`Jam buka ${weekdays[index]} sesi ${slotIndex + 1}`} type="time" required value={slot.opens_at} onChange={(e) => setSchedule(schedule.map((day, i) => i === index ? { ...day, slots: day.slots.map((value, j) => j === slotIndex ? { ...value, opens_at: e.target.value } : value) } : day))} />
                            <span>—</span>
                            <input aria-label={`Jam tutup ${weekdays[index]} sesi ${slotIndex + 1}`} type="time" required value={slot.closes_at} onChange={(e) => setSchedule(schedule.map((day, i) => i === index ? { ...day, slots: day.slots.map((value, j) => j === slotIndex ? { ...value, closes_at: e.target.value } : value) } : day))} />
                            <button type="button" className="remove-slot" aria-label={`Hapus sesi ${slotIndex + 1} ${weekdays[index]}`} onClick={() => setSchedule(schedule.map((day, i) => i === index ? { ...day, slots: day.slots.filter((_, j) => j !== slotIndex) } : day))}><X size={15} /></button>
                          </div>)}
                        </div>
                    ))}
                  </div>
                  <button className="button button-primary save-button">Simpan data fasilitas <ArrowUpRight size={18} /></button>
                </form>

                {editingId && selected?.facility_id === editingId && (
                  <div className="exception-panel">
                    <h3>Perubahan jam / hari khusus</h3>
                    <form className="exception-form" onSubmit={addException}>
                      <label>Tanggal<input type="date" required min={new Date().toISOString().slice(0, 10)} value={exceptionForm.exception_date} onChange={(e) => setExceptionForm({ ...exceptionForm, exception_date: e.target.value })} /></label>
                      <label>Catatan<input maxLength="255" placeholder="Contoh: Libur nasional" value={exceptionForm.note} onChange={(e) => setExceptionForm({ ...exceptionForm, note: e.target.value })} /></label>
                      <label className="closed-toggle"><input type="checkbox" checked={exceptionForm.is_closed} onChange={(e) => setExceptionForm({ ...exceptionForm, is_closed: e.target.checked })} /> Tutup</label>
                      {!exceptionForm.is_closed && <div className="exception-hours"><input type="time" value={exceptionForm.opens_at} onChange={(e) => setExceptionForm({ ...exceptionForm, opens_at: e.target.value })} /><span>—</span><input type="time" value={exceptionForm.closes_at} onChange={(e) => setExceptionForm({ ...exceptionForm, closes_at: e.target.value })} /></div>}
                      <button className="button button-dark">Simpan pengecualian</button>
                    </form>
                    {!!selected.exceptions?.length && <div className="exception-list">{selected.exceptions.map((item) => <div key={item.exception_id}><span><b>{item.exception_date}</b> · {item.is_closed ? 'Tutup' : `${item.opens_at}–${item.closes_at}`} {item.note && `· ${item.note}`}</span><button aria-label="Hapus pengecualian" onClick={() => deleteException(item.exception_id)}><X size={16} /></button></div>)}</div>}
                  </div>
                )}
              </div>
            </div>}
            {adminTab === 'content' && <div className="admin-grid">
              <aside className="admin-list card">
                <h2>Konten tersimpan <span className="count-pill">{adminContents.length}</span></h2>
                {adminContents.map((content) => (
                  <button key={content.content_id} className={`admin-row ${editingContentId === content.content_id ? 'active' : ''}`} onClick={() => startEditContent(content)}>
                    <span><b>{content.title}</b><small>{content.content_type} · {content.is_published ? 'Terbit' : 'Draf'}</small></span><ArrowUpRight size={16} />
                  </button>
                ))}
                {!adminContents.length && <p className="muted">Belum ada konten.</p>}
              </aside>
              <form className="card admin-form-card" onSubmit={saveContent}>
                <div className="form-heading">
                  <div><span className="eyebrow">{editingContentId ? 'EDIT KONTEN' : 'KONTEN BARU'}</span><h2>{editingContentId ? 'Perbarui konten' : 'Tambah konten kesehatan'}</h2></div>
                  {editingContentId && <button type="button" className="button button-danger" onClick={() => removeContent(adminContents.find((item) => item.content_id === editingContentId))}>Hapus</button>}
                </div>
                <div className="form-grid">
                  <label>Jenis konten<select value={contentForm.content_type} onChange={(event) => setContentForm({ ...contentForm, content_type: event.target.value })}><option value="informasi">Informasi kesehatan</option><option value="artikel">Artikel kesehatan</option></select></label>
                  <label>Status publikasi<select value={contentForm.is_published ? 'published' : 'draft'} onChange={(event) => setContentForm({ ...contentForm, is_published: event.target.value === 'published' })}><option value="published">Terbit</option><option value="draft">Draf</option></select></label>
                  <label className="wide">Judul<input required maxLength="150" value={contentForm.title} onChange={(event) => setContentForm({ ...contentForm, title: event.target.value })} /></label>
                  <label className="wide">Ringkasan<textarea required rows="2" maxLength="500" value={contentForm.summary} onChange={(event) => setContentForm({ ...contentForm, summary: event.target.value })} /></label>
                  <label className="wide">Isi konten<textarea required rows="8" maxLength="15000" value={contentForm.body} onChange={(event) => setContentForm({ ...contentForm, body: event.target.value })} /></label>
                </div>
                <button className="button button-primary save-button">Simpan konten <ArrowUpRight size={18} /></button>
                <p className="muted">Gunakan informasi yang telah diperiksa. Konten kesehatan bukan pengganti konsultasi tenaga kesehatan.</p>
              </form>
            </div>}
            {adminTab === 'users' && <div className="admin-grid">
              <aside className="admin-list card">
                <h2>Pengguna terdaftar <span className="count-pill">{users.length}</span></h2>
                {users.map((user) => (
                  <button key={user.user_id} className={`admin-row ${editingUserId === user.user_id ? 'active' : ''}`} onClick={() => startEditUser(user)}>
                    <span><b>{user.full_name}</b><small>{user.email} · {user.role}</small></span><ArrowUpRight size={16} />
                  </button>
                ))}
                {!users.length && <p className="muted">Belum ada pengguna.</p>}
              </aside>
              <form className="card admin-form-card" onSubmit={saveUser}>
                <div className="form-heading">
                  <div><span className="eyebrow">{editingUserId ? 'EDIT AKUN' : 'AKUN BARU'}</span><h2>{editingUserId ? 'Perbarui pengguna' : 'Tambah pengguna'}</h2></div>
                  {editingUserId && <button type="button" className="button button-danger" onClick={() => removeUser(users.find((item) => item.user_id === editingUserId))}>Hapus</button>}
                </div>
                <div className="form-grid">
                  <label className="wide">Nama lengkap<input required minLength="2" maxLength="100" value={userForm.full_name} onChange={(event) => setUserForm({ ...userForm, full_name: event.target.value })} /></label>
                  <label className="wide">Email<input required type="email" maxLength="100" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} /></label>
                  <label>Peran<select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}><option value="masyarakat">Masyarakat</option><option value="admin">Admin</option></select></label>
                  <label>Kata sandi<input type="password" autoComplete="new-password" minLength="12" maxLength="128" required={!editingUserId} value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} placeholder={editingUserId ? 'Kosongkan jika tidak diubah' : 'Minimal 12 karakter'} /></label>
                </div>
                <button className="button button-primary save-button">Simpan pengguna <ArrowUpRight size={18} /></button>
                <p className="muted">Setidaknya satu akun admin harus tetap tersedia. Kata sandi disimpan dalam bentuk hash.</p>
              </form>
            </div>}
            {adminTab === 'settings' && <form className="card admin-form-card settings-form" onSubmit={saveSiteSettings}>
              <div className="form-heading"><div><span className="eyebrow">IDENTITAS SITUS</span><h2>Pengaturan website</h2></div></div>
              <div className="form-grid">
                <label>Nama website<input required maxLength="100" value={adminSettings.website_name} onChange={(event) => setAdminSettings({ ...adminSettings, website_name: event.target.value })} /></label>
                <label>Tagline<input required maxLength="160" value={adminSettings.tagline} onChange={(event) => setAdminSettings({ ...adminSettings, tagline: event.target.value })} /></label>
                <label className="wide">Deskripsi beranda<textarea required rows="3" maxLength="500" value={adminSettings.homepage_description} onChange={(event) => setAdminSettings({ ...adminSettings, homepage_description: event.target.value })} /></label>
                <label>Nomor WhatsApp<input required maxLength="20" value={adminSettings.whatsapp_number} onChange={(event) => setAdminSettings({ ...adminSettings, whatsapp_number: event.target.value })} /></label>
              </div>
              <button className="button button-primary save-button"><Settings size={17} /> Simpan pengaturan</button>
            </form>}
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="container hero-grid">
                <div className="hero-copy">
                  <span className="eyebrow"><span className="live-dot" /> INFORMASI FASILITAS KESEHATAN</span>
                  <h1>Layanan sehat,<br /><span>lebih dekat.</span></h1>
                  <p>{siteSettings.homepage_description}</p>
                  <div className="hero-actions">
                    <a className="button button-dark hero-cta" href="#cari">Cari fasilitas <ArrowUpRight size={19} /></a>
                    <a className="button button-outline hero-cta" href={getWhatsAppHref(siteSettings.whatsapp_number)} target="_blank" rel="noreferrer"><Phone size={17} /> WhatsApp {siteSettings.whatsapp_number}</a>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="art-ring ring-one" /><div className="art-ring ring-two" />
                  <div className="art-cross"><Cross size={86} strokeWidth={3.5} /></div>
                  <div className="art-card art-card-top"><span className="art-icon"><Clock3 size={18} /></span><span><b>Jam operasional</b><small>Jelas sebelum berangkat</small></span></div>
                  <div className="art-card art-card-bottom"><span className="art-icon"><MapPin size={18} /></span><span><b>Lokasi terarah</b><small>Temukan yang terdekat</small></span></div>
                  <div className="art-star">+</div>
                </div>
              </div>
            </section>

            <section className="container content-section" id="cari">
              <div className="section-intro">
                <div><span className="eyebrow">PILIHAN LAYANAN</span><h2>Fasilitas untuk<br /><span className="text-blue">kebutuhanmu.</span></h2></div>
                <p>Informasi fasilitas kesehatan dapat berubah. Pastikan status dan detail layanan sebelum berkunjung.</p>
              </div>

              <div className="search-panel">
                <div className="search-box"><Search size={20} /><input placeholder="Cari nama fasilitas atau alamat..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                <select aria-label="Filter jenis fasilitas" value={type} onChange={(e) => setType(e.target.value)}><option value="">Semua jenis</option>{facilityTypes.map((value) => <option key={value}>{value}</option>)}</select>
                <select aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Semua status</option>{facilityStatuses.map((value) => <option key={value}>{value}</option>)}</select>
                <input className="service-filter" aria-label="Cari layanan" placeholder="Nama layanan..." value={service} onChange={(e) => setService(e.target.value)} />
              </div>
              {error && <div className="alert">{error}</div>}
              {!hasLoadedFacilities ? (
                <div className="empty-state loading-state" role="status"><span className="loading-spinner" /> Memuat informasi fasilitas...</div>
              ) : (
                <>
                {loading && <div className="results-loading" role="status"><span className="loading-spinner" /> Memperbarui hasil...</div>}
                <div className="results-grid" aria-busy={loading}>
                  <div className="facility-list">
                    <div className="results-caption" aria-live="polite"><span>{facilities.length} FASILITAS DITEMUKAN</span><span className="accent-line" /></div>
                    {facilities.map((facility) => (
                      <button key={facility.facility_id} className={`facility-card ${selectedId === facility.facility_id ? 'selected' : ''}`} onClick={() => setSelectedId(facility.facility_id)}>
                        <span className="facility-symbol"><Stethoscope size={21} /></span>
                        <span className="facility-main"><span className="facility-card-title">{facility.facility_name}</span><span className="facility-type">{facility.facility_type}</span><span className={statusStyle(facility.status)}>{facility.status}</span></span>
                        <ArrowUpRight className="facility-arrow" size={19} />
                      </button>
                    ))}
                    {!facilities.length && <div className="empty-state">Belum ada hasil. Coba kata kunci atau filter lain.</div>}
                  </div>

                  <div className="detail-column">
                    <div className="map-frame">
                      <MapContainer center={mapCenter} zoom={selected ? 14 : 11} scrollWheelZoom={false} key={`${mapCenter[0]}-${mapCenter[1]}`}>
                        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {coordinates.map((facility) => <CircleMarker key={facility.facility_id} center={[Number(facility.latitude), Number(facility.longitude)]} radius={selectedId === facility.facility_id ? 10 : 7} pathOptions={{ color: selectedId === facility.facility_id ? '#075985' : '#0284c7', fillColor: '#38bdf8', fillOpacity: 0.9 }} eventHandlers={{ click: () => setSelectedId(facility.facility_id) }}><Tooltip>{facility.facility_name}</Tooltip></CircleMarker>)}
                      </MapContainer>
                      <span className="map-label"><MapPin size={15} /> PETA LOKASI</span>
                    </div>
                    {selected ? (
                      <article className="detail-card">
                        <div className="detail-topline"><span className="eyebrow">INFORMASI FASILITAS</span><span className={statusStyle(selected.status)}>{selected.status}</span></div>
                        <h3>{selected.facility_name}</h3>
                        <span className="detail-type">{selected.facility_type}</span>
                        <div className="detail-info"><MapPin size={18} /><span>{selected.address}</span></div>
                        {selected.phone_number && <div className="detail-info"><span className="detail-icon">☎</span><a href={`tel:${selected.phone_number}`}>{selected.phone_number}</a></div>}
                        <div className="today-hours"><Clock3 size={19} /><span><small>JAM HARI INI</small><b>{getTodayHours(selected.hours, selected.exceptions)}</b></span></div>
                        {!!selected.services?.length && <div className="service-tags"><b>Layanan</b><div>{selected.services.map((item) => <span key={item.service_id} title={item.description || ''}>{item.service_name}</span>)}</div></div>}
                        <div className="weekly-hours"><b>Jadwal mingguan</b>{weekdays.map((day, index) => {
                          const rows = selected.hours?.filter((hour) => hour.day_of_week === index + 1) || [];
                          const closed = !rows.length || rows.every((hour) => hour.is_closed);
                          const text = closed ? 'Tutup' : rows.filter((hour) => !hour.is_closed).map((hour) => `${hour.opens_at}–${hour.closes_at}`).join(' · ');
                          return <div key={day}><span>{day}</span><span>{text}</span></div>;
                        })}</div>
                        {!!selected.exceptions?.length && <div className="special-hours"><b>Perubahan jam mendatang</b>{selected.exceptions.map((item) => <div key={item.exception_id}><span>{item.exception_date}{item.note ? ` · ${item.note}` : ''}</span><span>{item.is_closed ? 'Tutup' : `${item.opens_at}–${item.closes_at}`}</span></div>)}</div>}
                        <a className="button button-primary direction-link" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`}>Petunjuk arah <ArrowUpRight size={17} /></a>
                        {token && <button className="text-button edit-link" onClick={() => startEdit(selected)}>Edit informasi fasilitas</button>}
                      </article>
                    ) : <div className="detail-card empty-detail"><MapPin size={28} /><p>Pilih fasilitas untuk melihat detail layanan dan jam operasional.</p></div>}
                  </div>
                </div>
                </>
              )}
            </section>
            <section className="container content-section health-services-section" id="layanan">
              <div className="section-intro">
                <div><span className="eyebrow">JELAJAHI LAYANAN</span><h2>Layanan <span className="text-blue">kesehatan.</span></h2></div>
                <p>Pilih jenis layanan untuk mencari fasilitas yang menyediakannya.</p>
              </div>
              <div className="health-services-grid">
                {healthServices.map((item) => (
                  <button className="health-service-card" key={item.service_name} onClick={() => {
                    setSearch('');
                    setType('');
                    setStatus('');
                    setService(item.service_name);
                    document.getElementById('cari')?.scrollIntoView({ behavior: 'smooth' });
                  }}>
                    <span className="facility-symbol"><Stethoscope size={21} /></span>
                    <span><b>{item.service_name}</b><small>{item.facility_count} fasilitas aktif</small></span>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
                {!healthServices.length && <div className="empty-state">Informasi layanan akan tampil setelah data layanan fasilitas tersedia.</div>}
              </div>
            </section>
            <section className="container content-section health-content-section" id="informasi">
              <div className="section-intro">
                <div><span className="eyebrow">PANDUAN PENGUNJUNG</span><h2>Informasi <span className="text-blue">kesehatan.</span></h2></div>
                <p>Informasi umum untuk membantu Anda menggunakan direktori fasilitas.</p>
              </div>
              <div className="health-content-grid">
                {publicContents.filter((item) => item.content_type === 'informasi').map((item) => (
                  <article className="health-content-card" key={item.content_id}>
                    <span className="content-card-icon"><FileText size={20} /></span>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <button className="text-button" onClick={() => setActiveContent(item)}>Baca informasi <ArrowUpRight size={15} /></button>
                  </article>
                ))}
                {!publicContents.some((item) => item.content_type === 'informasi') && <div className="empty-state">Informasi kesehatan belum tersedia.</div>}
              </div>
            </section>
            <section className="container content-section health-content-section" id="artikel">
              <div className="section-intro">
                <div><span className="eyebrow">BACAAN KESEHATAN</span><h2>Artikel <span className="text-blue">pilihan.</span></h2></div>
                <p>Baca artikel kesehatan dan informasi layanan yang telah dipublikasikan.</p>
              </div>
              <div className="health-content-grid">
                {publicContents.filter((item) => item.content_type === 'artikel').map((item) => (
                  <article className="health-content-card" key={item.content_id}>
                    <span className="content-card-icon"><BookOpen size={20} /></span>
                    <h3>{item.title}</h3>
                    <p>{item.summary}</p>
                    <button className="text-button" onClick={() => setActiveContent(item)}>Baca artikel <ArrowUpRight size={15} /></button>
                  </article>
                ))}
                {!publicContents.some((item) => item.content_type === 'artikel') && <div className="empty-state">Artikel kesehatan belum tersedia.</div>}
              </div>
            </section>
            <section className="container whatsapp-banner">
              <div><span className="eyebrow">HUBUNGI KAMI</span><h2>Ada yang ingin ditanyakan?</h2><p>Hubungi kami melalui WhatsApp di <b>{siteSettings.whatsapp_number}</b>.</p></div>
              <a className="button button-primary" href={getWhatsAppHref(siteSettings.whatsapp_number)} target="_blank" rel="noreferrer"><Phone size={17} /> Chat WhatsApp <ArrowUpRight size={17} /></a>
            </section>
          </>
        )}
      </main>
      {notice && <div className="toast">{notice}</div>}
      {activeContent && <div className="content-modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setActiveContent(null);
      }}>
        <article className="content-modal" role="dialog" aria-modal="true" aria-labelledby="content-modal-title">
          <button className="content-modal-close" aria-label="Tutup artikel" onClick={() => setActiveContent(null)}><X size={20} /></button>
          <span className="eyebrow">{activeContent.content_type === 'artikel' ? 'ARTIKEL KESEHATAN' : 'INFORMASI KESEHATAN'}</span>
          <h2 id="content-modal-title">{activeContent.title}</h2>
          <p className="content-modal-summary">{activeContent.summary}</p>
          <div className="content-modal-body">{activeContent.body}</div>
          <p className="content-disclaimer">Informasi ini bersifat umum dan bukan pengganti konsultasi tenaga kesehatan.</p>
        </article>
      </div>}
      <footer className="site-footer"><div className="container"><a className="brand footer-brand" href="#"><span className="brand-mark"><Cross size={18} strokeWidth={3} /></span><span>{siteSettings.website_name}</span></a><span>{siteSettings.tagline}</span><span>© {new Date().getFullYear()} {siteSettings.website_name}</span></div></footer>
    </div>
  );
}

export default App;
