import { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabase';

export default function Admin() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Состояния формы
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('PHONK');
  const [bpm, setBpm] = useState('120');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null); // Новое поле для обложки
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Ошибка входа: ' + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile || !title) return alert('Пожалуйста, укажи название и выбери аудиофайл!');
    setIsUploading(true);

    try {
      // 1. Загружаем аудиофайл
      const audioExt = audioFile.name.split('.').pop();
      const audioName = `${Date.now()}-audio.${audioExt}`;
      const { error: audioUploadError } = await supabase.storage
        .from('public-assets')
        .upload(audioName, audioFile);

      if (audioUploadError) throw audioUploadError;

      const { data: { publicUrl: audioUrl } } = supabase.storage
        .from('public-assets')
        .getPublicUrl(audioName);

      // 2. Загружаем обложку (если она выбрана)
      let coverUrl = '';
      if (coverFile) {
        const coverExt = coverFile.name.split('.').pop();
        const coverName = `${Date.now()}-cover.${coverExt}`;
        const { error: coverUploadError } = await supabase.storage
          .from('public-assets')
          .upload(coverName, coverFile);

        if (coverUploadError) throw coverUploadError;

        const { data: { publicUrl: cUrl } } = supabase.storage
          .from('public-assets')
          .getPublicUrl(coverName);
        coverUrl = cUrl;
      }

      // 3. Записываем всё в таблицу tracks
      const { error: dbError } = await supabase.from('tracks').insert([{
        title: title,
        genre: genre,
        bpm: parseInt(bpm),
        audio_preview_url: audioUrl,
        cover_url: coverUrl || null // Сохраняем ссылку на обложку
      }]);

      if (dbError) throw dbError;

      alert('БИТ И ОБЛОЖКА УСПЕШНО ОПУБЛИКОВАНЫ!');
      setTitle(''); 
      setAudioFile(null);
      setCoverFile(null);
      
    } catch (error: any) {
      alert('Ошибка при загрузке: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  if (!session) {
    return (
      <div style={{ backgroundColor: '#050505', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'sans-serif' }}>
        <Head><title>ADMIN LOGIN</title></Head>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '300px', padding: '40px', border: '1px solid #222', borderRadius: '10px', backgroundColor: '#0a0a0a' }}>
          <div style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px', marginBottom: '20px' }}>WHYNSIE <span style={{ color: '#00f3ff' }}>SECURE</span></div>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          <button type="submit" style={btnStyle}>ACCESS PORTAL</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#050505', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white', fontFamily: 'sans-serif', padding: '50px' }}>
      <Head><title>WHYNSIE CABIN</title></Head>
      
      <div style={{ width: '100%', maxWidth: '600px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '1.5rem', letterSpacing: '4px' }}>UPLOAD <span style={{ color: '#00f3ff' }}>BEAT</span></div>
        <button onClick={handleLogout} style={{ ...btnStyle, width: 'auto', padding: '10px 20px', backgroundColor: 'transparent', border: '1px solid #333' }}>LOGOUT</button>
      </div>

      <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '25px', width: '100%', maxWidth: '600px', padding: '40px', border: '1px solid #222', borderRadius: '10px', backgroundColor: '#0a0a0a' }}>
        
        <div>
          <label style={labelStyle}>BEAT TITLE</label>
          <input type="text" required placeholder="e.g. MIDNIGHT DRIFT" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>GENRE</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)} style={inputStyle}>
              <option value="PHONK">PHONK</option>
              <option value="TRAP">TRAP</option>
              <option value="DRILL">DRILL</option>
              <option value="SOUL">90s SOUL</option>
              <option value="R&B">R&B</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>BPM</label>
            <input type="number" required value={bpm} onChange={(e) => setBpm(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>AUDIO FILE (MP3/WAV)</label>
          <input type="file" required accept="audio/*" onChange={(e) => setAudioFile(e.target.files ? e.target.files[0] : null)} style={{ ...inputStyle, padding: '10px 0' }} />
        </div>

        <div>
          <label style={labelStyle}>COVER ART (IMAGE)</label>
          <input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files ? e.target.files[0] : null)} style={{ ...inputStyle, padding: '10px 0' }} />
        </div>

        <button type="submit" disabled={isUploading} style={{ ...btnStyle, opacity: isUploading ? 0.5 : 1, marginTop: '20px' }}>
          {isUploading ? 'PUBLISING...' : 'PUBLISH BEAT'}
        </button>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '15px', backgroundColor: '#111', border: '1px solid #333', color: 'white', borderRadius: '5px', outline: 'none', letterSpacing: '1px' };
const labelStyle = { display: 'block', fontSize: '0.7rem', color: '#888', letterSpacing: '2px', marginBottom: '10px' };
const btnStyle = { width: '100%', padding: '15px', backgroundColor: '#00f3ff', color: '#000', border: 'none', borderRadius: '5px', fontWeight: 'bold', letterSpacing: '2px', cursor: 'pointer', transition: 'all 0.3s' };