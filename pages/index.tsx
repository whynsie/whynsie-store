import { useState, useRef, useMemo, useEffect } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { supabase } from '../lib/supabase';

// -----------------------------------------------------------------------------
// 1. 3D-ДВИЖОК: КАПЛИ
// -----------------------------------------------------------------------------
const RainMatrix = ({ isPlaying, isMobile }: { isPlaying: boolean, isMobile: boolean }) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetOpacity = useRef(0);
  const dropCount = isMobile ? 40 : 100;

  const drops = useMemo(() => {
    return new Array(dropCount).fill(0).map(() => ({
      position: new THREE.Vector3((Math.random() - 0.5) * 20, Math.random() * 20, (Math.random() - 0.5) * 10),
      speed: 0.1 + Math.random() * 0.2,
      isExploded: false,
      explosionTimer: 0
    }));
  }, [dropCount]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    targetOpacity.current = THREE.MathUtils.lerp(targetOpacity.current, isPlaying ? 1 : 0, delta * 5);
    
    if (targetOpacity.current < 0.01 && !isPlaying) {
      groupRef.current.visible = false;
      return;
    } else {
      groupRef.current.visible = true;
    }

    const beat = Math.sin(state.clock.elapsedTime * 6) > 0.85 ? 1.3 : 1;

    groupRef.current.children.forEach((mesh, i) => {
      const drop = drops[i];
      if (!drop.isExploded) {
        mesh.position.y -= drop.speed * beat; 
        if (mesh.position.y < -5) {
          drop.isExploded = true;
          drop.explosionTimer = 1;
          mesh.scale.set(beat * 2.5, 0.1, beat * 2.5); 
        }
        mesh.material.opacity = 0.7 * targetOpacity.current;
      } else {
        drop.explosionTimer -= 0.05;
        mesh.scale.x *= 0.9;
        mesh.scale.z *= 0.9;
        mesh.material.opacity = drop.explosionTimer * targetOpacity.current;

        if (drop.explosionTimer <= 0) {
          drop.isExploded = false;
          mesh.position.y = 10 + Math.random() * 5;
          mesh.scale.set(0.1, 1.2, 0.1);
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      {drops.map((_, i) => (
        <mesh key={i} position={drops[i].position}>
          <cylinderGeometry args={[0.02, 0.02, 1, 4]} />
          <meshStandardMaterial color="#00f3ff" emissive="#00f3ff" emissiveIntensity={1.5} transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
};

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [tracks, setTracks] = useState<any[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);

  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Welcome. I am the AI assistant for whynsie. Specify a genre or mood.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); 
    window.addEventListener('resize', handleResize);

    const fetchBeats = async () => {
      try {
        const { data, error } = await supabase.from('tracks').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        if (data && data.length > 0) setTracks(data);
      } catch (error) {
        console.error('Ошибка загрузки битов:', error);
      } finally {
        setIsLoadingTracks(false);
      }
    };

    fetchBeats();

    audioRef.current = new Audio();
    audioRef.current.addEventListener('ended', () => setIsPlaying(false));
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const selectTrack = (idx: number) => {
    if (!audioRef.current || tracks.length === 0) return;
    audioRef.current.src = tracks[idx].audio_preview_url;
    audioRef.current.play();
    setActiveIdx(idx);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (!audioRef.current || tracks.length === 0) return;
    if (!audioRef.current.src || !audioRef.current.src.includes(tracks[activeIdx].audio_preview_url)) {
      audioRef.current.src = tracks[activeIdx].audio_preview_url;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePan = (e: any, info: PanInfo) => {
    if (tracks.length === 0) return;
    setDragOffset(info.offset.y * 0.15); 
  };

  const handlePanEnd = (e: any, info: PanInfo) => {
    if (tracks.length === 0) return;
    const shift = Math.round((info.offset.y * 0.15) / 25);
    
    if (shift !== 0) {
      let newIdx = (activeIdx - shift) % tracks.length;
      if (newIdx < 0) newIdx += tracks.length; 
      selectTrack(newIdx);
    }
    setDragOffset(0);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userText = input;
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'bot', text: data.reply }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'bot', text: 'System offline. Contact via Telegram.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ background: '#050505', color: '#fff', minHeight: '100vh', fontFamily: 'Helvetica Neue, sans-serif', paddingBottom: isMobile ? '100px' : '0' }}>
      
      {/* 1. ШАПКА */}
      <div style={{ position: 'relative', padding: isMobile ? '40px 5vw 20px' : '80px 5vw 40px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', zIndex: 10 }}>
        {!isMobile && (
          <div style={{ position: 'absolute', top: '40px', right: '5vw', display: 'flex', gap: '30px', zIndex: 50 }}>
            <a href="#" style={{ color: '#666', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '2px' }}>INSTAGRAM</a>
            <a href="#" style={{ color: '#666', textDecoration: 'none', fontSize: '0.75rem', letterSpacing: '2px' }}>TELEGRAM</a>
          </div>
        )}
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} style={{ fontSize: isMobile ? '2rem' : '3rem', letterSpacing: '8px', fontWeight: '300', margin: '0 0 10px 0', textTransform: 'uppercase' }}>
          Whynsie
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.3 }} style={{ color: '#666', fontSize: '0.8rem', letterSpacing: '4px', margin: 0, textTransform: 'uppercase' }}>
          Audio Production & Sound Design
        </motion.p>
      </div>

      {/* 2. ПЛЕЕР (Теперь вся область ловит свайп, а touchAction: none блокирует ложный скролл на мобилках) */}
      <motion.div 
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        style={{ 
          display: 'flex', height: isMobile ? '65vh' : '600px', 
          overflow: 'hidden', position: 'relative', 
          touchAction: 'none', // КРИТИЧНО ДЛЯ МОБИЛЬНЫХ: отключает прокрутку экрана в зоне барабана
          cursor: 'grab' 
        }}
        whileTap={{ cursor: 'grabbing' }}
      >
        
        {/* ЛЕВАЯ ЧАСТЬ: ВРАЩАЮЩАЯСЯ ПОЛУСФЕРА (Барабан) */}
        <div style={{ width: isMobile ? '100%' : '40%', position: 'relative', display: 'flex', alignItems: 'center', zIndex: 15 }}>
            {isLoadingTracks ? (
              <div style={{ position: 'absolute', left: isMobile ? '20px' : '10%', top: '50%', transform: 'translateY(-50%)', color: '#00f3ff', letterSpacing: '4px', fontSize: '0.8rem' }}>
                LOADING...
              </div>
            ) : tracks.length === 0 ? (
               <div style={{ position: 'absolute', left: isMobile ? '20px' : '10%', top: '50%', transform: 'translateY(-50%)', color: '#666', letterSpacing: '2px', fontSize: '0.8rem' }}>
                NO BEATS
              </div>
            ) : (
              <motion.div
                animate={{ rotate: -activeIdx * 25 + dragOffset }}
                transition={{ type: "spring", stiffness: 60, damping: 20, mass: 1 }}
                style={{ 
                  position: 'absolute', 
                  left: isMobile ? '15%' : '-30px', // На мобильных сдвигаем барабан чуть правее для красоты
                  top: '50%', width: 0, height: 0 
                }}
              >
                {tracks.map((t, i) => {
                  const angle = i * 25; 
                  const rad = (angle * Math.PI) / 180;
                  const radius = isMobile ? 150 : 220; 
                  
                  const x = Math.cos(rad) * radius;
                  const y = Math.sin(rad) * radius;

                  return (
                    <motion.div 
                      key={t.id || i} 
                      animate={{ 
                        opacity: activeIdx === i ? 1 : 0.2,
                        scale: activeIdx === i ? 1.05 : 0.9
                      }}
                      transition={{ duration: 0.3 }}
                      style={{ 
                        position: 'absolute', left: 0, top: '-15px', x, y, rotate: angle, 
                        transformOrigin: 'left center',
                        fontSize: isMobile ? '0.85rem' : '1rem', 
                        letterSpacing: isMobile ? '3px' : '5px', 
                        fontWeight: activeIdx === i ? '500' : '300',
                        whiteSpace: 'nowrap', textTransform: 'uppercase', display: 'flex', alignItems: 'center',
                        zIndex: 20
                      }}
                      onClick={(e) => {
                        e.stopPropagation(); // Чтобы клик не конфликтовал со свайпом
                        selectTrack(i);
                      }}
                    >
                      <span style={{ color: activeIdx === i ? '#fff' : '#666', marginRight: '15px', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        0{i + 1}
                      </span>
                      <span style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                        {t.title}
                        <span style={{ fontSize: '0.6rem', color: '#00f3ff', marginTop: '2px', letterSpacing: '2px' }}>{t.genre} • {t.bpm} BPM</span>
                      </span>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
        </div>

        {/* ЦЕНТРАЛЬНАЯ КНОПКА PLAY (Только для ПК) */}
        {!isMobile && (
          <div style={{ position: 'absolute', left: '40%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 30 }}>
            <button 
              onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
              disabled={tracks.length === 0}
              style={{
                width: '70px', height: '70px', borderRadius: '50%', backgroundColor: 'rgba(20,20,20,0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: tracks.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', transition: 'all 0.3s', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', opacity: tracks.length === 0 ? 0.3 : 1
              }}
            >
              {isPlaying ? (
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                 <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '4px' }}><path d="M5 3l14 9-14 9V3z"/></svg>
              )}
            </button>
          </div>
        )}

        {/* ПРАВАЯ ЧАСТЬ: ИНТЕРАКТИВНЫЕ 3D КАПЛИ + ОБЛОЖКА */}
        <div style={isMobile ? {
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none'
        } : { 
          position: 'relative', width: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', pointerEvents: 'none'
        }}>
          {tracks[activeIdx]?.cover_url && (
            <motion.div
              key={tracks[activeIdx].id}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: isPlaying ? 0.25 : 0.04, scale: isPlaying ? 1 : 0.98 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                backgroundImage: `url("${tracks[activeIdx].cover_url}")`,
                backgroundPosition: isMobile ? 'right center' : 'center', 
                backgroundSize: isMobile ? 'cover' : '60%', 
                backgroundRepeat: 'no-repeat', filter: 'blur(3px)', zIndex: 0
              }}
            />
          )}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
            <Canvas camera={{ position: [0, 0, 15] }}>
              <ambientLight intensity={0.2} />
              <pointLight position={[10, 10, 10]} color="#00f3ff" intensity={2} />
              <RainMatrix isPlaying={isPlaying} isMobile={isMobile} />
            </Canvas>
          </div>
        </div>
      </motion.div>

      {/* 3. ИИ-ЧАТ */}
      {!isMobile ? (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '80px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ paddingBottom: '20px', marginBottom: '30px' }}><h2 style={{ color: '#fff', fontSize: '0.8rem', letterSpacing: '4px', margin: 0, fontWeight: 'normal' }}>AI CONCIERGE</h2></div>
          <div style={{ height: '300px', overflowY: 'auto', padding: '0 20px 20px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                <span style={{ display: 'inline-block', fontSize: '0.9rem', lineHeight: '1.5', letterSpacing: '1px', color: msg.role === 'user' ? '#888' : '#fff', maxWidth: '80%' }}>{msg.text}</span>
              </div>
            ))}
            {isLoading && <div style={{ color: '#555', fontSize: '0.8rem', letterSpacing: '1px', fontStyle: 'italic' }}>Typing...</div>}
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="INQUIRE ABOUT BEATS OR LEASING..." style={{ flex: 1, padding: '15px 0', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'transparent', color: 'white', outline: 'none', fontSize: '0.8rem', letterSpacing: '2px', fontFamily: 'inherit' }} />
            <button onClick={sendMessage} disabled={isLoading} style={{ padding: '0 30px', border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'transparent', color: 'white', cursor: 'pointer', fontSize: '0.75rem', letterSpacing: '2px' }}>SEND</button>
          </div>
        </div>
      ) : (
        <>
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            style={{ position: 'fixed', bottom: '110px', right: '20px', zIndex: 1100, width: '55px', height: '55px', borderRadius: '50%', backgroundColor: 'rgba(5,5,5,0.9)', border: '1px solid #00f3ff', color: '#00f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(0, 243, 255, 0.3)', backdropFilter: 'blur(10px)', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '2px' }}
          >
            {isChatOpen ? 'X' : 'AI'}
          </button>
          
          {isChatOpen && (
            <div style={{ position: 'fixed', bottom: '180px', right: '20px', left: '20px', height: '350px', backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid rgba(0, 243, 255, 0.3)', borderRadius: '15px', padding: '20px', zIndex: 1050, backdropFilter: 'blur(15px)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '15px' }}>
                {messages.map((msg, index) => (
                  <div key={index} style={{ textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                    <span style={{ display: 'inline-block', fontSize: '0.8rem', lineHeight: '1.4', color: msg.role === 'user' ? '#888' : '#fff', maxWidth: '90%' }}>{msg.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Ask AI..." style={{ flex: 1, padding: '10px', borderRadius: '5px', border: '1px solid #333', backgroundColor: '#000', color: 'white', fontSize: '0.8rem', outline: 'none' }} />
                <button onClick={sendMessage} style={{ padding: '10px 15px', borderRadius: '5px', backgroundColor: '#00f3ff', color: '#000', border: 'none', fontWeight: 'bold', fontSize: '0.7rem' }}>SEND</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 4. МОБИЛЬНЫЙ ЛИПКИЙ ПЛЕЕР */}
      {isMobile && tracks.length > 0 && (
        <div style={{ 
          position: 'fixed', bottom: 0, left: 0, 
          width: '100%', height: '90px', 
          backgroundColor: 'rgba(5,5,5,0.95)', borderTop: '1px solid rgba(255,255,255,0.1)', 
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          padding: '0 20px', 
          boxSizing: 'border-box', // КРИТИЧНО ДЛЯ МОБИЛЬНЫХ: не дает плееру вылезти за края экрана
          backdropFilter: 'blur(15px)' 
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', whiteSpace: 'nowrap', zIndex: 1001 }}>
            <span style={{ color: '#fff', fontSize: '1rem', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>{tracks[activeIdx]?.title}</span>
            <span style={{ color: '#00f3ff', fontSize: '0.65rem', letterSpacing: '2px', marginTop: '4px' }}>{tracks[activeIdx]?.genre} • {tracks[activeIdx]?.bpm} BPM</span>
          </div>
          
          <button 
            onClick={togglePlayPause}
            style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#fff', color: '#000', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}
          >
            {isPlaying ? (
               <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
               <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '3px' }}><path d="M5 3l14 9-14 9V3z"/></svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}