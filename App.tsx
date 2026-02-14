
import React, { useState, useEffect, useRef } from 'react';
import { BotProject, FlowStep, ChatMessage, InteractionType, UserAccountSession } from './types';
import { COLORS, ICONS } from './constants';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [project, setProject] = useState<BotProject>({
    id: 'proj-1',
    name: 'My Personal Assistant',
    description: 'Automated responses for my personal Telegram account.',
    botToken: '',
    steps: [
      { id: '1', trigger: 'AFK', triggerType: 'keyword', response: "Hey! I'm currently away from my phone. I'll get back to you soon!" },
      { id: '2', trigger: 'hello', triggerType: 'keyword', response: "Hi there! This is my automated assistant. How can I help?" },
    ],
    aiConfig: {
      enabled: true,
      systemPrompt: 'You are a personal assistant acting on behalf of the user. Be friendly but clarify you are an automated assistant if the user seems confused.',
      personality: 'Casual and helpful'
    },
    targetConfig: {
      allChats: true,
      whitelist: [],
      blacklist: []
    }
  });

  const [session, setSession] = useState<UserAccountSession>({
    isConnected: false,
    phoneNumber: '',
    apiId: '',
    apiHash: '',
    username: 'Guest User',
  });

  const [activeStepId, setActiveStepId] = useState<string | null>(project.steps[0]?.id || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [view, setView] = useState<'editor' | 'simulator' | 'settings' | 'account'>('editor');
  const [loginStep, setLoginStep] = useState<'form' | 'otp' | 'success' | 'guide' | 'connecting'>('form');
  const [otp, setOtp] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeStep = project.steps.find(s => s.id === activeStepId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addStep = () => {
    const newStep: FlowStep = {
      id: Date.now().toString(),
      trigger: 'new keyword',
      triggerType: 'keyword',
      response: 'My automated response'
    };
    setProject({ ...project, steps: [...project.steps, newStep] });
    setActiveStepId(newStep.id);
  };

  const updateStep = (id: string, updates: Partial<FlowStep>) => {
    setProject({
      ...project,
      steps: project.steps.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  const deleteStep = (id: string) => {
    const filtered = project.steps.filter(s => s.id !== id);
    setProject({ ...project, steps: filtered });
    if (activeStepId === id) setActiveStepId(filtered[0]?.id || null);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: userInput,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setIsSimulating(true);

    let botResponseText = '';
    const matchedStep = project.steps.find(step => {
      if (step.triggerType === 'keyword') return userMsg.text.toLowerCase().includes(step.trigger.toLowerCase());
      if (step.triggerType === 'command') return userMsg.text === step.trigger;
      if (step.triggerType === 'regex') {
        try { return new RegExp(step.trigger, 'i').test(userMsg.text); } catch { return false; }
      }
      return false;
    });

    if (matchedStep) {
      botResponseText = matchedStep.response;
    } else if (project.aiConfig.enabled) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: userMsg.text,
          config: {
            systemInstruction: `${project.aiConfig.systemPrompt} Personality: ${project.aiConfig.personality}. Known rules: ${project.steps.map(s => `If they say "${s.trigger}", reply "${s.response}"`).join('. ')}`
          }
        });
        botResponseText = result.text || "I'm currently unavailable.";
      } catch (error) {
        botResponseText = "Error communicating with AI.";
      }
    }

    if (botResponseText) {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'me',
        text: botResponseText,
        timestamp: Date.now()
      };
      setTimeout(() => {
        setMessages(prev => [...prev, botMsg]);
        setIsSimulating(false);
      }, 800);
    } else {
      setIsSimulating(false);
    }
  };

  const startLogin = () => {
    if (!session.phoneNumber || !session.apiId || !session.apiHash) {
      alert("Please fill in all API credentials or enter Sandbox Mode.");
      return;
    }
    setLoginStep('connecting');
    // Simulate a network delay for visual feedback
    setTimeout(() => {
      setLoginStep('otp');
    }, 2000);
  };

  const verifyOtp = () => {
    if (otp.length < 5) {
      alert("Please enter the valid verification code.");
      return;
    }
    setLoginStep('success');
    setSession({ ...session, isConnected: true, username: '@TeleFlowUser' });
    setTimeout(() => { setView('simulator'); }, 1500);
  };

  const enterSandboxMode = () => {
    setLoginStep('success');
    setSession({ ...session, isConnected: false, username: 'Sandbox Mode' });
    setTimeout(() => { setView('editor'); }, 1000);
  };

  const generateExportCode = () => {
    const stepsJson = JSON.stringify(project.steps, null, 2);
    return `
/**
 * TeleFlow AI Production Script
 * Requirements: npm install telegram input
 */
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

const apiId = ${session.apiId || 'YOUR_API_ID'};
const apiHash = "${session.apiHash || 'YOUR_API_HASH'}";
const stringSession = new StringSession(""); // fill this later with saved session

(async () => {
  console.log("Loading interactive session...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });
  
  await client.start({
    phoneNumber: async () => await input.text("Please enter your number: "),
    password: async () => await input.text("Please enter your password: "),
    phoneCode: async () => await input.text("Please enter the code you received: "),
    onError: (err) => console.log(err),
  });

  console.log("You are now connected.");
  console.log(client.session.save()); // Save this string to stay logged in

  const rules = ${stepsJson};

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message || !message.text) return;

    const sender = await message.getSender();
    console.log(\`Received message: "\${message.text}" from \${sender.username || sender.id}\`);

    for (const rule of rules) {
      let match = false;
      if (rule.triggerType === 'keyword' && message.text.toLowerCase().includes(rule.trigger.toLowerCase())) match = true;
      if (rule.triggerType === 'command' && message.text === rule.trigger) match = true;
      if (rule.triggerType === 'regex' && new RegExp(rule.trigger, 'i').test(message.text)) match = true;

      if (match) {
        console.log(\`Responding with: \${rule.response}\`);
        await client.sendMessage(message.chatId, { message: rule.response });
        return;
      }
    }
  });
})();`;
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-800 glass flex flex-col z-20">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h1 className="font-bold text-xl flex items-center gap-2 text-cyan-400">
            <ICONS.Zap /> TeleFlow AI
          </h1>
        </div>

        <nav className="p-4 grid grid-cols-2 gap-2 border-b border-slate-800">
          <button 
            onClick={() => setView('editor')}
            className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${view === 'editor' ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-slate-800 text-slate-500'}`}
          >
            Editor
          </button>
          <button 
            onClick={() => setView('simulator')}
            className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${view === 'simulator' ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-slate-800 text-slate-500'}`}
          >
            Simulator
          </button>
        </nav>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          <div className="flex justify-between items-center px-2 mb-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Automation Flow</span>
            <button onClick={addStep} className="p-1 hover:bg-slate-700 rounded text-cyan-400 transition">
              <ICONS.Plus />
            </button>
          </div>
          
          {project.steps.map(step => (
            <div 
              key={step.id}
              onClick={() => { setView('editor'); setActiveStepId(step.id); }}
              className={`group p-3 rounded-xl cursor-pointer transition border ${activeStepId === step.id && view === 'editor' ? 'bg-slate-800 border-cyan-500/50 shadow-lg shadow-cyan-500/10' : 'bg-transparent border-transparent hover:bg-slate-800'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                  {step.triggerType.toUpperCase()}
                </span>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteStep(step.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition"
                >
                  <ICONS.Trash />
                </button>
              </div>
              <p className="text-sm font-semibold truncate text-slate-100">{step.trigger}</p>
              <p className="text-xs text-slate-400 truncate mt-1">{step.response}</p>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button 
            onClick={() => { setView('account'); setLoginStep('form'); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition ${view === 'account' ? 'bg-slate-800 text-cyan-400' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <div className="flex items-center gap-3">
              <ICONS.User /> {session.isConnected ? 'Account Live' : 'Connect Account'}
            </div>
            {session.isConnected && <span className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50"></span>}
          </button>
          <button 
            onClick={() => setView('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${view === 'settings' ? 'bg-slate-800 text-cyan-400' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <ICONS.Settings /> Preferences
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {view === 'account' ? (
          <div className="h-full flex flex-col items-center justify-center p-12 animate-in fade-in duration-500 max-w-2xl mx-auto">
            {loginStep === 'form' && (
              <div className="w-full space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-cyan-500/10 text-cyan-400 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                    <ICONS.Smartphone />
                  </div>
                  <h2 className="text-3xl font-bold text-white">Connect Telegram</h2>
                  <p className="text-slate-400">Design automation logic for your account. (Simulator/Designer Mode)</p>
                  <div className="mt-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[10px] text-indigo-300 uppercase font-black tracking-widest">
                    Browser security prevents direct MTProto connection. Use "Skip to Simulator" to test flows, then Export code to go live.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">API ID</label>
                    <input 
                      type="text"
                      value={session.apiId}
                      onChange={(e) => setSession({...session, apiId: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                      placeholder="1234567"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">API Hash</label>
                    <input 
                      type="password"
                      value={session.apiHash}
                      onChange={(e) => setSession({...session, apiHash: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                      placeholder="a1b2..."
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone Number</label>
                  <input 
                    type="tel"
                    value={session.phoneNumber}
                    onChange={(e) => setSession({...session, phoneNumber: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                    placeholder="+1234567890"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={startLogin}
                    className="w-full py-4 rounded-xl bg-cyan-500 text-white font-bold hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
                  >
                    Simulate Login Code
                  </button>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setLoginStep('guide')}
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:bg-slate-700 transition"
                    >
                      How to get keys?
                    </button>
                    <button 
                      onClick={enterSandboxMode}
                      className="flex-1 py-3 px-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold hover:bg-indigo-500/20 transition"
                    >
                      Skip to Simulator
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loginStep === 'connecting' && (
              <div className="w-full flex flex-col items-center justify-center space-y-6 animate-pulse">
                <div className="w-24 h-24 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">Sending Request...</h3>
                  <p className="text-slate-400 text-sm">Attempting to reach Telegram MTProto Servers</p>
                </div>
              </div>
            )}

            {loginStep === 'guide' && (
              <div className="w-full space-y-6 animate-in slide-in-from-bottom-4">
                <header className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-white">How to get API ID/Hash</h2>
                  <p className="text-slate-400 text-sm">Follow these 3 simple steps to get your credentials from Telegram.</p>
                </header>

                <div className="space-y-4">
                  {[
                    { step: "1", text: "Login to my.telegram.org with your phone number.", icon: "🌐" },
                    { step: "2", text: "Click on 'API Development Tools'.", icon: "🛠️" },
                    { step: "3", text: "Fill the form (App title/Short name) to get your ID and Hash.", icon: "📋" }
                  ].map((item) => (
                    <div key={item.step} className="flex gap-4 p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                      <div className="w-10 h-10 shrink-0 bg-cyan-500/10 text-cyan-400 rounded-xl flex items-center justify-center font-bold">{item.step}</div>
                      <div className="flex flex-col justify-center">
                        <p className="text-sm font-medium text-slate-200">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <a 
                    href="https://my.telegram.org" 
                    target="_blank" 
                    className="w-full py-3 bg-cyan-500 text-white text-center rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    Open my.telegram.org <ICONS.ExternalLink />
                  </a>
                  <button 
                    onClick={() => setLoginStep('form')}
                    className="w-full text-slate-500 text-sm hover:text-white transition"
                  >
                    Back to Form
                  </button>
                </div>
              </div>
            )}

            {loginStep === 'otp' && (
              <div className="w-full space-y-8 animate-in slide-in-from-right-4 text-center">
                <h2 className="text-3xl font-bold text-white">Enter Code</h2>
                <p className="text-slate-400">Verification code sent to your Telegram app.</p>
                <input 
                  type="text"
                  maxLength={5}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-5 text-center text-4xl font-mono tracking-[1rem] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="-----"
                />
                <button 
                  onClick={verifyOtp}
                  className="w-full py-4 rounded-xl bg-cyan-500 text-white font-bold hover:bg-cyan-400 transition"
                >
                  Verify Account
                </button>
              </div>
            )}

            {loginStep === 'success' && (
              <div className="text-center space-y-4 animate-in zoom-in">
                <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-green-500/20">
                   <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h2 className="text-3xl font-bold text-white">Success!</h2>
                <p className="text-slate-400">Environment initialized. Ready for automation simulation.</p>
              </div>
            )}
          </div>
        ) : view === 'editor' && activeStep ? (
          <div className="h-full flex flex-col p-12 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Rule Designer</h2>
                <p className="text-slate-400">Configure what triggers an automated response.</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
                <span className={`w-2 h-2 rounded-full ${session.isConnected ? 'bg-green-500' : 'bg-indigo-500'}`}></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {session.isConnected ? 'Live Session (Simulated)' : 'Sandbox Active'}
                </span>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Trigger Type</label>
                <select 
                  value={activeStep.triggerType}
                  onChange={(e) => updateStep(activeStep.id, { triggerType: e.target.value as InteractionType })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                >
                  <option value="keyword">Keyword Match</option>
                  <option value="command">Custom Command</option>
                  <option value="regex">Advanced Regex</option>
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search Pattern</label>
                <input 
                  type="text"
                  value={activeStep.trigger}
                  onChange={(e) => updateStep(activeStep.id, { trigger: e.target.value })}
                  placeholder="e.g. 'pricing'"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Auto-Reply Content</label>
              <textarea 
                value={activeStep.response}
                onChange={(e) => updateStep(activeStep.id, { response: e.target.value })}
                rows={6}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition resize-none leading-relaxed"
                placeholder="What will your account say back..."
              />
            </div>

            <div className="flex justify-end pt-4">
              <button className="px-8 py-4 rounded-xl bg-cyan-500 text-white font-bold hover:bg-cyan-400 transition flex items-center gap-2 shadow-lg shadow-cyan-500/20">
                <ICONS.Save /> Update Rule
              </button>
            </div>
          </div>
        ) : view === 'simulator' ? (
          <div className="h-full flex flex-col animate-in slide-in-from-right-4 duration-300">
             <div className="p-6 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Flow Simulator</h2>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-400">Testing behavior for: <span className="text-slate-100 font-medium">{session.username}</span></p>
                </div>
              </div>
              <button onClick={() => setMessages([])} className="text-xs text-slate-400 hover:text-white transition">Clear History</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 space-y-4">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center"><ICONS.MessageCircle /></div>
                  <p className="text-sm">Type a message below to see how your rules react.</p>
                </div>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-start' : 'items-end'}`}>
                  <span className="text-[10px] font-bold text-slate-500 mb-1 px-2 uppercase tracking-widest">
                    {m.sender === 'user' ? 'Someone Else' : (session.isConnected ? 'You (Automated)' : 'Your Account')}
                  </span>
                  <div className={`max-w-[70%] p-4 rounded-2xl ${m.sender === 'user' ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700' : 'bg-cyan-600 text-white rounded-tr-none shadow-lg'}`}>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                    <span className="text-[9px] opacity-60 mt-2 block text-right font-mono">
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {isSimulating && (
                <div className="flex justify-end">
                   <div className="flex flex-col items-end">
                    <div className="bg-cyan-900/40 p-4 rounded-2xl rounded-tr-none border border-cyan-500/20 flex gap-1.5">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-150"></span>
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce delay-300"></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50">
              <div className="max-w-4xl mx-auto flex gap-3">
                <input 
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message as if you were another person..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-white transition"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isSimulating}
                  className="px-6 bg-cyan-500 rounded-xl text-white hover:bg-cyan-400 transition disabled:opacity-50 flex items-center gap-2"
                >
                  <ICONS.Send />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col p-12 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
             <header>
              <h2 className="text-3xl font-bold text-white mb-2">System Settings</h2>
              <p className="text-slate-400">AI logic and global automation behavior.</p>
            </header>

            <div className="space-y-6">
              <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg"><ICONS.Bot /></div>
                    <div>
                      <h3 className="font-semibold text-white">Gemini AI Fallback</h3>
                      <p className="text-sm text-slate-500">Respond using AI when no static rules match.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={project.aiConfig.enabled}
                      onChange={(e) => setProject({ ...project, aiConfig: { ...project.aiConfig, enabled: e.target.checked } })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Bar */}
      <div className="absolute top-6 right-6 flex gap-4 pointer-events-none">
        <div className="pointer-events-auto bg-slate-800/90 backdrop-blur border border-slate-700 px-4 py-2.5 rounded-2xl flex items-center gap-4 shadow-2xl">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${session.isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {session.isConnected ? 'Live Simulation' : 'Simulator Mode'}
            </span>
          </div>
          <div className="h-4 w-[1px] bg-slate-700"></div>
          <button 
            className="text-cyan-400 text-xs font-black hover:text-cyan-300 transition flex items-center gap-2 group"
            onClick={() => setShowExportModal(true)}
          >
            <ICONS.Code /> EXPORT SCRIPT
          </button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e293b] w-full max-w-4xl max-h-[90vh] rounded-3xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">Production Automation Script</h3>
                <p className="text-sm text-slate-400">Run this Node.js script locally to go live with your rules.</p>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-2 hover:bg-slate-800 rounded-full transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-900 font-mono text-sm leading-relaxed text-cyan-200">
              <pre>{generateExportCode()}</pre>
            </div>
            <div className="p-6 border-t border-slate-800 flex justify-between items-center">
              <div className="flex gap-2">
                 <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400">Node.js</span>
                 <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400">GramJS</span>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(generateExportCode());
                  alert("Script copied to clipboard!");
                }}
                className="px-6 py-3 bg-cyan-500 text-white rounded-xl font-bold hover:bg-cyan-400 transition shadow-lg shadow-cyan-500/20"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
