import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import {
  ArrowUpRight, Clock3, Cross, LogOut, MapPin, Search, ShieldCheck,
  Stethoscope, X
} from 'lucide-react';
import { api } from './api.js';

const weekdays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const facilityStatuses = ['Aktif', 'Tidak Aktif', 'Perlu Verifikasi'];
const emptyFacility = {
  facility_name: '', facility_type: 'Puskesmas', address: '', phone_number: '',
  status: 'Perlu Verifikasi', latitude: '', longitude: ''
};

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

function App() {
  const [page, setPage] = useState('public');
  const [facilities, setFacilities] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [service, setService] = useState('');
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const filters = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (type) params.set('type', type);
    if (status) params.set('status', status);
    if (service.trim()) params.set('service', service.trim());
    return params.toString();
  }, [search, type, status, service]);

  const loadFacilities = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api(`/facilities${filters ? `?${filters}` : ''}`);
      setFacilities(data);
      setSelectedId((current) => data.some((item) => item.facility_id === current)
        ? current : data[0]?.facility_id || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadSelected = useCallback(async (id) => {
    if (!id) {
      setSelected(null);
      return;
    }
    try {
      setSelected(await api(`/facilities/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { loadFacilities(); }, [loadFacilities]);
  useEffect(() => { loadSelected(selectedId); }, [selectedId, loadSelected]);
  useEffect(() => {
    api('/facilities')
      .then((data) => setFacilityTypes([...new Set(data.map((item) => item.facility_type))]))
      .catch((err) => setError(err.message));
  }, []);

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

  function signOut() {
    localStorage.removeItem('admin-token');
    setToken('');
    setPage('public');
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
            <span>Sehat<span className="brand-light">Dekat</span></span>
          </a>
          <div className="header-actions">
            <span className="header-caption"><span className="live-dot" /> INFO LAYANAN KESEHATAN</span>
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
              <button className="button button-primary" onClick={startCreate}><Cross size={17} /> Tambah fasilitas</button>
            </div>
            {error && <div className="alert">{error}</div>}
            <div className="admin-grid">
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
            </div>
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="container hero-grid">
                <div className="hero-copy">
                  <span className="eyebrow"><span className="live-dot" /> INFORMASI FASILITAS KESEHATAN</span>
                  <h1>Layanan sehat,<br /><span>lebih dekat.</span></h1>
                  <p>Temukan fasilitas kesehatan, cek layanan, jam operasional, dan lokasi sebelum berangkat.</p>
                  <a className="button button-dark hero-cta" href="#cari">Cari fasilitas <ArrowUpRight size={19} /></a>
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
              {notice && <div className="toast">{notice}</div>}
              {error && <div className="alert">{error}</div>}
              {loading ? <div className="empty-state">Memuat informasi fasilitas...</div> : (
                <div className="results-grid">
                  <div className="facility-list">
                    <div className="results-caption"><span>{facilities.length} FASILITAS DITEMUKAN</span><span className="accent-line" /></div>
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
              )}
            </section>
          </>
        )}
      </main>
      <footer className="site-footer"><div className="container"><a className="brand footer-brand" href="#"><span className="brand-mark"><Cross size={18} strokeWidth={3} /></span><span>Sehat<span className="brand-light">Dekat</span></span></a><span>Informasi fasilitas kesehatan dalam satu langkah.</span><span>© {new Date().getFullYear()} SehatDekat</span></div></footer>
    </div>
  );
}

export default App;
