import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // States for Search & Library
  const [data, setData] = useState(null);
  const [chemicalList, setChemicalList] = useState([]);
  
  // State for Visual Lab
  const [moleculeData, setMoleculeData] = useState(null);

  // Chat States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([{ sender: 'bot', text: 'Hello! Ask me anything about green chemistry.' }]);
  
  // Reaction Lab States
  const [reactants, setReactants] = useState(['', '']);
  const [reactionResult, setReactionResult] = useState(null);

  // Upload States
  const [uploadStatus, setUploadStatus] = useState('');
  const [batchResults, setBatchResults] = useState(null);

  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/list')
      .then(res => res.json())
      .then(setChemicalList)
      .catch(err => console.error("Backend offline."));
  }, []);

  // --- ACTIONS ---

  const handleAction = async (name) => {
    const target = name || query;
    if (!target || target === "default") return;
    setIsLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/compare/${encodeURIComponent(target)}`);
      const result = await response.json();
      setData(result);
      setQuery(target);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisualSearch = async () => {
    if (!query) return;
    setIsLoading(true);
    setMoleculeData(null);
    try {
      const response = await fetch(`http://127.0.0.1:8000/molecule-info/${encodeURIComponent(query)}`);
      const result = await response.json();
      setMoleculeData(result);
    } catch (err) {
      console.error("Visual fetch error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactionAnalyze = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/analyze-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactants: reactants.filter(r => r) }),
      });
      const result = await response.json();
      setReactionResult(result);
    } catch (err) {
      console.error("Reaction analysis error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploadStatus('Processing...');
    try {
      const response = await fetch('http://127.0.0.1:8000/upload', { method: 'POST', body: formData });
      const result = await response.json();
      setBatchResults(result);
      setUploadStatus(`Analyzed ${result.total_count} items.`);
    } catch (error) {
      setUploadStatus('Error uploading.');
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { sender: 'user', text: chatInput };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setMessages(prev => [...prev, { sender: 'bot', text: '...' }]);
    try {
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput }),
      });
      const result = await response.json();
      setMessages(prev => [...prev.slice(0, -1), { sender: 'bot', text: result.reply }]);
    } catch (error) {
      setMessages(prev => [...prev.slice(0, -1), { sender: 'bot', text: "Connection error." }]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 font-sans text-slate-900 relative">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <header className="mb-10 text-center">
          <h1 className="text-5xl font-black text-emerald-900 tracking-tighter italic">Eco-Chem Trace</h1>
          <p className="text-slate-500 font-medium mt-2">Sustainable Reagent Intelligence & Molecular Lab</p>
          
          <nav className="flex flex-wrap justify-center gap-3 mt-8">
            {['search', 'visual', 'reaction', 'upload'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-8 py-3 rounded-2xl font-bold transition-all transform active:scale-95 ${
                  activeTab === tab 
                  ? 'bg-emerald-600 text-white shadow-xl scale-105' 
                  : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {tab === 'visual' ? '🔬 VISUAL LAB' : tab.toUpperCase()}
              </button>
            ))}
          </nav>
        </header>

        {/* --- TAB 1: SEARCH --- */}
        {activeTab === 'search' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4">
              <select onChange={(e) => handleAction(e.target.value)} value={query} className="flex-1 bg-slate-50 border-none p-4 rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500">
                <option value="default">Quick Select from Library...</option>
                {chemicalList.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <input 
                className="flex-1 bg-slate-50 border-none p-4 rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500" 
                placeholder="Type a chemical name..." 
                value={query} 
                onChange={(e) => setQuery(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && handleAction()} 
              />
              <button onClick={() => handleAction()} className="bg-emerald-700 text-white px-12 py-4 rounded-2xl font-black hover:bg-emerald-800 transition-all shadow-lg">
                {isLoading ? '...' : 'ANALYZE'}
              </button>
            </div>

            {data?.found && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-8 rounded-[2rem] shadow-lg border-t-[12px] bg-white ${data.target.is_green ? 'border-emerald-500' : 'border-rose-500'}`}>
                  <h2 className="text-4xl font-black text-slate-800 mb-3">{data.target.name}</h2>
                  <p className="text-lg text-slate-600 leading-relaxed mb-6">{data.target.reason}</p>
                  {data.target.native_use && <a href={data.target.native_use} target="_blank" rel="noreferrer" className="text-emerald-600 font-bold underline">View PubChem Safety Data →</a>}
                </div>
                {(!data.target.is_green && data.alternative) && (
                  <div className="p-8 rounded-[2rem] bg-emerald-900 text-white shadow-2xl relative overflow-hidden flex flex-col justify-center">
                    <span className="bg-emerald-500 w-fit px-3 py-1 rounded-lg text-[10px] font-black mb-4 tracking-widest">GREENER SUBSTITUTE</span>
                    <h3 className="text-4xl font-bold mb-4">{data.alternative.name}</h3>
                    <button onClick={() => { setQuery(data.alternative.name); handleAction(data.alternative.name); }} className="bg-white text-emerald-900 px-6 py-2 rounded-xl font-bold w-fit hover:bg-emerald-100 transition-colors">Switch to this reagent</button>
                    <div className="absolute -right-10 -bottom-10 text-[12rem] opacity-10 rotate-12 pointer-events-none">🌿</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 2: VISUAL LAB --- */}
        {activeTab === 'visual' && (
          <div className="animate-in fade-in duration-500 space-y-8">
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
              <input 
                className="flex-1 bg-slate-50 border-none p-4 rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500" 
                placeholder="Enter chemical for 2D structure..." 
                value={query} 
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleVisualSearch()}
              />
              <button onClick={handleVisualSearch} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-black shadow-lg">
                {isLoading ? 'Fetching...' : 'GENERATE MODEL'}
              </button>
            </div>

            {moleculeData?.found ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center">
                   <span className="text-xs font-black text-slate-400 mb-6 tracking-widest uppercase">2D Molecular Architecture</span>
                   <img src={moleculeData.image_2d} alt="Molecular structure" className="w-64 h-64 object-contain hover:scale-110 transition-transform duration-500" />
                   <p className="mt-8 text-slate-400 text-sm italic text-center">Auto-rendered from PubChem PUG database</p>
                </div>

                <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-3xl font-black text-slate-800 tracking-tight">Chemical Metadata</h3>
                      <p className="text-emerald-600 font-bold uppercase text-xs tracking-widest mt-1">Property Analysis</p>
                    </div>
                    <span className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold">CID: {moleculeData.cid}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Molecular Formula</p>
                      <p className="text-xl font-bold text-slate-800">{moleculeData.properties.MolecularFormula}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Molecular Weight</p>
                      <p className="text-xl font-bold text-slate-800">{moleculeData.properties.MolecularWeight} <span className="text-xs font-medium">g/mol</span></p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Lipophilicity (XLogP)</p>
                      <p className="text-xl font-bold text-slate-800">{moleculeData.properties.XLogP || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Complexity</p>
                      <p className="text-xl font-bold text-slate-800">{moleculeData.properties.Complexity}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Net Charge</p>
                      <p className="text-xl font-bold text-slate-800">{moleculeData.properties.Charge}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Exact Mass</p>
                      <p className="text-xl font-bold text-slate-800">{moleculeData.properties.ExactMass}</p>
                    </div>
                  </div>

                  <a href={moleculeData.pubchem_link} target="_blank" rel="noreferrer" className="mt-10 inline-block bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-700 transition-all shadow-md text-sm">
                    Open Full Structural Report
                  </a>
                </div>
              </div>
            ) : (
              <div className="h-64 border-4 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-400 font-bold">
                 {isLoading ? "Consulting PubChem Databases..." : "Search for a molecule to begin visual analysis"}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: REACTION LAB (Updated with 12 Principles) --- */}
        {activeTab === 'reaction' && (
          <div className="animate-in fade-in max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-10 rounded-[2rem] shadow-sm border border-slate-200">
              <h2 className="text-3xl font-black text-slate-800 mb-2">Reaction Hazard Analyzer</h2>
              <p className="text-slate-500 mb-8 font-medium">Verify your pathway against the 12 principles of green chemistry.</p>
              {reactants.map((r, i) => (
                <input key={i} value={r} onChange={(e) => { const newR = [...reactants]; newR[i] = e.target.value; setReactants(newR); }} placeholder={`Reactant ${i+1}`} className="w-full mb-3 p-4 bg-slate-50 border-none ring-1 ring-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all" />
              ))}
              <button onClick={() => setReactants([...reactants, ''])} className="text-emerald-600 font-black mb-8 block ml-auto hover:text-emerald-800 transition-colors">+ ADD REACTANT</button>
              <button onClick={handleReactionAnalyze} className="w-full bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black text-xl hover:bg-emerald-700 shadow-xl transition-all">
                  {isLoading ? 'ANALYZING PATHWAY...' : 'ANALYZE GREEN SCORE'}
              </button>

              {reactionResult && (
                <div className="mt-10 animate-in zoom-in-95">
                  <div className={`p-8 rounded-[2rem] border-2 mb-8 ${reactionResult.is_green ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                    <h3 className="text-2xl font-black flex items-center gap-3 mb-4">
                        {reactionResult.is_green ? '🌿 ECO-SAFE PATH' : '⚠️ HAZARD DETECTED'}
                    </h3>
                    <p className="text-lg leading-relaxed mb-6 font-medium">{reactionResult.warning || reactionResult.message}</p>
                    {reactionResult.alternative_suggestion && (
                        <div className="bg-white bg-opacity-60 p-5 rounded-2xl border border-current border-opacity-10 text-sm">
                            <strong className="block mb-1 uppercase tracking-widest text-[10px]">Expert Recommendation</strong> 
                            {reactionResult.alternative_suggestion}
                        </div>
                    )}
                  </div>

                  {/* 12 Principles Grid */}
                  <div className="bg-slate-100 p-8 rounded-[2.5rem]">
                    <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6 text-center">Sustainability Audit: 12 Principles</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {reactionResult.principles?.map((p) => (
                        <div 
                          key={p.id} 
                          className={`p-4 rounded-2xl border flex flex-col gap-2 transition-all ${
                            p.status 
                            ? 'bg-white border-emerald-200 shadow-sm' 
                            : 'bg-white border-slate-200 opacity-50 grayscale'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${p.status ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>#{p.id}</span>
                            <span>{p.status ? '✅' : '⚪'}</span>
                          </div>
                          <span className="text-[11px] font-black text-slate-800 leading-tight uppercase">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 4: BATCH UPLOAD --- */}
        {activeTab === 'upload' && (
          <div className="animate-in fade-in duration-500">
            <div className="bg-white p-16 rounded-[3rem] shadow-sm border-4 border-dashed border-slate-200 text-center">
              <div className="text-6xl mb-6">📁</div>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="mb-6 block mx-auto text-sm text-slate-500 file:mr-4 file:py-3 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-black file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{uploadStatus || "Process high-volume CSV chemical lists"}</p>
            </div>
            {batchResults && (
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {batchResults.data.map((item, idx) => (
                  <div key={idx} className={`p-5 rounded-2xl border-2 flex justify-between items-center transition-all hover:scale-105 ${item.is_green ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                    <span className="font-black text-slate-700 truncate mr-2">{item.name}</span>
                    <span className="text-2xl">{item.is_green ? '🌿' : '⚠️'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- FLOATING CHATBOT --- */}
      <div className="fixed bottom-8 right-8 flex flex-col items-end z-50">
        {isChatOpen && (
          <div className="w-80 h-[500px] bg-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem] flex flex-col border border-slate-200 mb-6 overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
            <div className="bg-emerald-900 p-6 text-white font-black flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="tracking-tighter italic">ECO-CHAT</span>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-3xl font-light">&times;</button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto space-y-4 text-sm flex flex-col bg-slate-50">
              {messages.map((m, i) => (
                <div key={i} className={`${m.sender === 'user' ? 'self-end bg-emerald-700 text-white rounded-tr-none' : 'self-start bg-white text-slate-800 border border-slate-200 rounded-tl-none'} p-4 rounded-3xl max-w-[90%] shadow-sm font-medium`}>
                  {m.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t bg-white flex gap-2 items-center">
              <input 
                value={chatInput} 
                onChange={(e) => setChatInput(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()} 
                placeholder="Ask Eco-AI..." 
                className="flex-1 p-3 rounded-2xl border-none ring-1 ring-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 text-sm bg-slate-50 font-medium" 
              />
              <button onClick={sendChatMessage} className="bg-emerald-900 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black hover:bg-emerald-700 transition-all">➔</button>
            </div>
          </div>
        )}
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)} 
          className="bg-emerald-900 text-white w-20 h-20 rounded-[2rem] shadow-2xl flex items-center justify-center text-3xl hover:scale-110 active:scale-90 transition-all duration-300 group"
        >
          {isChatOpen ? '✕' : <span className="group-hover:rotate-12 transition-transform">💬</span>}
        </button>
      </div>
    </div>
  );
}

export default App;