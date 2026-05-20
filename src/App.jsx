import React, { useState, useEffect } from 'react';
import { 
  Camera, Zap, SunMoon, HandHeart, Info, Aperture, Timer, 
  SlidersHorizontal, Home, Wrench, PlusCircle, Ruler, Lightbulb, Trash2, AlertTriangle 
} from 'lucide-react';

// --- 預設情境資料 ---
const defaultScenarios = [
  {
    id: 'action',
    title: '神轎行進 / 陣頭',
    subtitle: '動態捕捉',
    icon: <Camera className="w-8 h-8 mb-2" />,
    mode: 'M 模式 (Manual)',
    shutter: '1/500s - 1/1000s',
    aperture: 'F2.8 - F4',
    focusTip: '凝結動作，確保主體清晰不殘影。',
    bgImage: 'bg-gradient-to-br from-red-900 to-red-950',
    themeColor: 'text-red-400',
    isCustom: false
  },
  {
    id: 'firework',
    title: '燃放鞭炮 / 炸寒單',
    subtitle: '高光與煙霧',
    icon: <Zap className="w-8 h-8 mb-2" />,
    mode: 'M 模式 (Manual)',
    shutter: '1/1000s 以上',
    aperture: 'F4 - F5.6',
    focusTip: '捕捉煙火噴發與煙霧層次。建議適度減 EV (-0.3 ~ -1.0)。',
    bgImage: 'bg-gradient-to-br from-orange-900 to-red-950',
    themeColor: 'text-orange-400',
    isCustom: false
  },
  {
    id: 'static',
    title: '信眾參拜 / 法相',
    subtitle: '靜態與景深',
    icon: <HandHeart className="w-8 h-8 mb-2" />,
    mode: 'A 模式 (Aperture)',
    shutter: '交由相機決定 (Auto)',
    aperture: 'F1.2 - F1.8',
    focusTip: '全開光圈虛化繁雜背景，凸顯神聖與寧靜感。',
    bgImage: 'bg-gradient-to-br from-amber-900 to-stone-900',
    themeColor: 'text-amber-400',
    isCustom: false
  },
  {
    id: 'night',
    title: '黃昏到夜晚過渡',
    subtitle: '弱光環境',
    icon: <SunMoon className="w-8 h-8 mb-2" />,
    mode: 'M 模式 (Manual) + Auto ISO',
    shutter: '1/250s - 1/500s',
    aperture: '最大光圈 (Max)',
    focusTip: '快門稍微放慢以吸收背景光，完全依賴自動 ISO 補償。',
    bgImage: 'bg-gradient-to-br from-blue-900 to-slate-950',
    themeColor: 'text-blue-400',
    isCustom: false
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [customScenarios, setCustomScenarios] = useState([]);
  const [activeScenarioId, setActiveScenarioId] = useState(defaultScenarios[0].id);

  const allScenarios = [...defaultScenarios, ...customScenarios];
  const activeScenario = allScenarios.find(s => s.id === activeScenarioId) || defaultScenarios[0];

  const [focalLength, setFocalLength] = useState(50);
  const [cropFactor, setCropFactor] = useState(1); 

  // --- 工具箱：真實光線偵測狀態 ---
  const [isDetecting, setIsDetecting] = useState(false);
  const [luxValue, setLuxValue] = useState(0);
  const [cameraError, setCameraError] = useState('');

  const [form, setForm] = useState({
    title: '', subtitle: '', mode: 'M 模式 (Manual)', shutter: '', aperture: '', focusTip: ''
  });

  // ==========================================
  // 真實相機測光邏輯 (TTL 測光法)
  // ==========================================
  useEffect(() => {
    let animationFrameId;
    let stream = null;
    
    // 建立隱藏的 video 與 canvas 元素用於影像分析
    const video = document.createElement('video');
    video.setAttribute('playsinline', ''); // 確保 iOS 可以不全螢幕播放
    const canvas = document.createElement('canvas');

    const analyzeFrame = () => {
      // 確保影片已載入且有數據
      if (!video || video.readyState !== 4) {
        animationFrameId = requestAnimationFrame(analyzeFrame);
        return;
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      // 縮小解析度以大幅降低運算負擔 (64x64 足以計算平均亮度)
      canvas.width = 64; 
      canvas.height = 64;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      
      // 逐像素讀取 RGB 並套用光度學公式計算人眼感知亮度 (Luminance)
      for (let i = 0; i < data.length; i += 4) {
        sum += (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114);
      }
      
      // 取得 0~255 的平均亮度
      const avgBrightness = sum / (canvas.width * canvas.height);

      // 將相機感光亮度映射為虛擬 Lux 值 (採用三次方的非線性映射，以符合現實光衰減)
      // 亮度 0 -> ~10 Lux (暗夜), 亮度 255 -> ~50000 Lux (直射陽光)
      const calcLux = Math.floor(Math.pow(avgBrightness / 255, 3) * 50000) + 10;
      setLuxValue(calcLux);

      // 持續進行下一幀分析
      animationFrameId = requestAnimationFrame(analyzeFrame);
    };

    if (isDetecting) {
      setCameraError('');
      // 請求開啟手機後置鏡頭 (environment)
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => {
          stream = s;
          video.srcObject = stream;
          video.play();
          animationFrameId = requestAnimationFrame(analyzeFrame);
        })
        .catch(err => {
          console.error("相機存取失敗", err);
          setIsDetecting(false);
          setCameraError('無法存取相機。請確認已開啟權限，且必須使用 HTTPS 網址。');
        });
    } else {
      setLuxValue(0);
    }

    // 元件卸載或停止偵測時，關閉相機並停止運算
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isDetecting]);

  const getLightSuggestion = (lux) => {
    if (!isDetecting) return { desc: '尚未啟動', setting: '-' };
    if (lux <= 10) return { desc: '測光中...', setting: '-' }; // 剛啟動或全黑
    if (lux > 15000) return { desc: '強烈直射陽光', setting: 'ISO 100 / F8 / 1/1000s' };
    if (lux > 3000) return { desc: '明亮戶外 / 陰天', setting: 'ISO 400 / F4 / 1/500s' };
    if (lux > 800) return { desc: '室內明亮處 / 騎樓', setting: 'ISO 800 / F2.8 / 1/250s' };
    if (lux > 100) return { desc: '昏暗微光 (廟宇內)', setting: 'ISO 3200 / F1.8 / 1/60s' };
    return { desc: '極度暗處', setting: '上腳架 / ISO 100 / F8 / 10s' };
  };

  const handleAddScenario = (e) => {
    e.preventDefault();
    if (!form.title || !form.shutter || !form.aperture) return alert('請填寫必要欄位！');
    
    const newScenario = {
      id: `custom-${Date.now()}`,
      title: form.title,
      subtitle: form.subtitle || '自訂情境',
      icon: <Camera className="w-8 h-8 mb-2" />, 
      mode: form.mode,
      shutter: form.shutter,
      aperture: form.aperture,
      focusTip: form.focusTip || '無特殊提示',
      bgImage: 'bg-gradient-to-br from-emerald-900 to-teal-950', 
      themeColor: 'text-emerald-400',
      isCustom: true
    };

    setCustomScenarios([...customScenarios, newScenario]);
    setForm({ title: '', subtitle: '', mode: 'M 模式 (Manual)', shutter: '', aperture: '', focusTip: '' });
    setActiveScenarioId(newScenario.id);
    setActiveTab('home');
  };

  const handleDeleteCustom = (id, e) => {
    e.stopPropagation();
    const updated = customScenarios.filter(s => s.id !== id);
    setCustomScenarios(updated);
    if (activeScenarioId === id) setActiveScenarioId(defaultScenarios[0].id);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500/30">
      
      <header className="bg-neutral-900 border-b border-neutral-800 p-4 sticky top-0 z-20 shadow-md">
        <div className="max-w-md mx-auto flex items-center justify-center gap-2">
          <Aperture className="w-6 h-6 text-amber-500" />
          <h1 className="text-xl font-bold tracking-wider text-amber-500">攝紀大師 <span className="text-sm font-normal text-neutral-400 tracking-normal">Pro</span></h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        
        {/* === 分頁 1: 首頁 === */}
        {activeTab === 'home' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="mb-6">
              <h2 className="text-sm font-semibold text-neutral-400 mb-3 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" /> 選擇拍攝情境
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {allScenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => setActiveScenarioId(scenario.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300 border-2 relative
                      ${activeScenarioId === scenario.id 
                        ? `border-amber-500 ${scenario.bgImage} shadow-lg shadow-amber-900/20 scale-[1.02]` 
                        : 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:bg-neutral-800'
                      }`}
                  >
                    {scenario.isCustom && (
                      <span onClick={(e) => handleDeleteCustom(scenario.id, e)} className="absolute top-2 right-2 p-1 text-white/30 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </span>
                    )}
                    <div className={activeScenarioId === scenario.id ? scenario.themeColor : ''}>
                      {scenario.icon}
                    </div>
                    <span className="text-sm font-bold text-center leading-tight">{scenario.title}</span>
                    <span className="text-xs mt-1 opacity-70">{scenario.subtitle}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className={`rounded-3xl p-6 ${activeScenario.bgImage} border border-white/10 shadow-2xl transition-all duration-500 relative overflow-hidden`}>
              <div className="absolute -right-10 -top-10 opacity-5 pointer-events-none">
                <Aperture className="w-48 h-48" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6 border-b border-white/20 pb-4">
                  <div className={`p-2 rounded-full bg-white/10 ${activeScenario.themeColor}`}>
                    {activeScenario.icon}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{activeScenario.title}</h2>
                    <p className="text-sm text-white/70">{activeScenario.subtitle}</p>
                  </div>
                  {activeScenario.isCustom && (
                    <span className="ml-auto text-xs px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/30">
                      自訂
                    </span>
                  )}
                </div>

                <div className="space-y-5">
                  <div className="flex justify-between items-center bg-black/30 p-4 rounded-xl">
                    <span className="text-white/60 text-sm font-medium">拍攝模式</span>
                    <span className="text-lg font-bold tracking-wide text-amber-400">{activeScenario.mode}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                      <Timer className="w-5 h-5 text-white/40 mb-1" />
                      <span className="text-white/60 text-xs mb-1">建議快門</span>
                      <span className="text-xl font-bold text-white">{activeScenario.shutter}</span>
                    </div>
                    <div className="bg-black/30 p-4 rounded-xl flex flex-col items-center justify-center text-center">
                      <Aperture className="w-5 h-5 text-white/40 mb-1" />
                      <span className="text-white/60 text-xs mb-1">建議光圈</span>
                      <span className="text-xl font-bold text-white">{activeScenario.aperture}</span>
                    </div>
                  </div>

                  <div className={`mt-6 bg-black/20 border p-4 rounded-xl ${activeScenario.isCustom ? 'border-emerald-500/20' : 'border-amber-500/20'}`}>
                    <h3 className={`${activeScenario.themeColor} text-sm font-bold mb-2 flex items-center gap-2`}>
                      <Info className="w-4 h-4" /> 拍攝重點
                    </h3>
                    <p className="text-sm text-white/80 leading-relaxed">
                      {activeScenario.focusTip}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* === 分頁 2: 工具箱 (含真實測光) === */}
        {activeTab === 'tools' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 安全快門 */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6">
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Ruler className="w-5 h-5 text-blue-400" /> 鏡頭安全快門換算
              </h2>
              <p className="text-xs text-neutral-400 mb-5">避免手震的最低快門速度建議</p>
              
              <div className="space-y-4">
                <div>
                  <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                    {[{v: 1, l: '全片幅 (FF)'}, {v: 1.5, l: 'APS-C'}, {v: 2, l: 'M43'}].map(c => (
                      <button key={c.v} onClick={() => setCropFactor(c.v)}
                        className={`flex-1 text-sm py-2 rounded-md transition-colors ${cropFactor === c.v ? 'bg-blue-600 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}>
                        {c.l}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm text-neutral-300 block">鏡頭焦段</label>
                    <span className="text-xl font-bold text-blue-400">{focalLength} <span className="text-sm font-normal text-neutral-500">mm</span></span>
                  </div>
                  <input type="range" min="10" max="600" step="5" value={focalLength} onChange={(e) => setFocalLength(e.target.value)}
                    className="w-full accent-blue-500" />
                </div>

                <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-xl mt-4 flex items-center justify-between">
                  <span className="text-sm text-blue-200">建議最低安全快門</span>
                  <span className="text-2xl font-black text-blue-400 drop-shadow-md">
                    1 / {Math.ceil(focalLength * cropFactor)}<span className="text-base text-blue-300/70 font-normal ml-1">s</span>
                  </span>
                </div>
              </div>
            </section>

            {/* 真實環境光線測光儀 */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 relative overflow-hidden">
              {isDetecting && <div className="absolute inset-0 bg-yellow-500/5 animate-pulse pointer-events-none"></div>}
              
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Lightbulb className={`w-5 h-5 ${isDetecting ? 'text-yellow-400' : 'text-neutral-500'}`} /> 實時環境測光 (TTL)
              </h2>
              <p className="text-xs text-neutral-400 mb-5">透過手機後置鏡頭分析光線，請將手機對準拍攝主體</p>
              
              <div className="flex flex-col items-center">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center border-4 mb-4 transition-all duration-300 shadow-[0_0_30px_rgba(234,179,8,0.1)]
                  ${isDetecting ? 'border-yellow-500 bg-yellow-950/30' : 'border-neutral-800 bg-neutral-950'}`}>
                  <div className="text-center">
                    <div className={`text-3xl font-black ${isDetecting ? 'text-yellow-400' : 'text-neutral-600'}`}>
                      {luxValue}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">LUX</div>
                  </div>
                </div>

                {cameraError && (
                  <div className="w-full bg-red-950/50 border border-red-900/50 p-3 rounded-xl mb-4 flex items-start gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <button 
                  onClick={() => setIsDetecting(!isDetecting)}
                  className={`px-8 py-3 rounded-full font-bold transition-colors w-full mb-4
                    ${isDetecting ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-yellow-500 text-neutral-950 hover:bg-yellow-400'}`}>
                  {isDetecting ? '停止測光' : '啟動後置鏡頭測光'}
                </button>

                <div className="w-full bg-black/40 rounded-xl p-4 text-center border border-white/5">
                  <div className="text-sm text-neutral-400 mb-1">{getLightSuggestion(luxValue).desc}</div>
                  <div className="text-lg font-bold text-white tracking-wide">{getLightSuggestion(luxValue).setting}</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* === 分頁 3: 新增自訂 === */}
        {activeTab === 'add' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold text-emerald-400 mb-4 flex items-center gap-2">
              <PlusCircle className="w-6 h-6" /> 建立專屬拍攝情境
            </h2>
            <form onSubmit={handleAddScenario} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-xl">
              
              <div className="space-y-1">
                <label className="text-xs text-emerald-500 font-bold">情境名稱 (必填)</label>
                <input type="text" placeholder="例如：演唱會追星、拍螢火蟲" required value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400">副標題</label>
                <input type="text" placeholder="例如：極端弱光環境" value={form.subtitle} onChange={e => setForm({...form, subtitle: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-emerald-500 font-bold">建議快門 (必填)</label>
                  <input type="text" placeholder="1/250s" required value={form.shutter} onChange={e => setForm({...form, shutter: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-emerald-500 font-bold">建議光圈 (必填)</label>
                  <input type="text" placeholder="F2.8" required value={form.aperture} onChange={e => setForm({...form, aperture: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400">曝光模式</label>
                <select value={form.mode} onChange={e => setForm({...form, mode: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors appearance-none">
                  <option>M 模式 (Manual)</option>
                  <option>A 模式 (Aperture)</option>
                  <option>S / Tv 模式 (Shutter)</option>
                  <option>P 模式 (Program)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-neutral-400">大師心法 (拍攝重點)</label>
                <textarea rows="3" placeholder="紀錄你的專屬拍攝筆記..." value={form.focusTip} onChange={e => setForm({...form, focusTip: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"></textarea>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl mt-4 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                儲存至我的情境庫
              </button>
            </form>
          </div>
        )}

      </main>

      <nav className="fixed bottom-0 w-full bg-neutral-900 border-t border-neutral-800 pb-safe pt-2 px-6 z-30">
        <div className="max-w-md mx-auto flex justify-between items-center pb-2">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'home' ? 'text-amber-500' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Home className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-bold">快門情境</span>
          </button>
          
          <button onClick={() => setActiveTab('add')} className={`flex flex-col items-center p-2 transition-colors relative -top-4 bg-neutral-950 rounded-full border-4 border-neutral-900 ${activeTab === 'add' ? 'text-emerald-500' : 'text-neutral-400 hover:text-white'}`}>
            <div className={`p-3 rounded-full ${activeTab === 'add' ? 'bg-emerald-500/20' : 'bg-neutral-800'}`}>
              <PlusCircle className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold mt-1 absolute -bottom-4">自訂</span>
          </button>

          <button onClick={() => setActiveTab('tools')} className={`flex flex-col items-center p-2 transition-colors ${activeTab === 'tools' ? 'text-blue-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Wrench className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-bold">大師工具</span>
          </button>
        </div>
      </nav>
      
      <style dangerouslySetInnerHTML={{__html: `
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}} />
    </div>
  );
}