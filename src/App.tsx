import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { format, differenceInMinutes, startOfYear, endOfYear, addMinutes, isWithinInterval } from 'date-fns';
import { Task, TaskStatus } from './types';
import { cn } from './lib/utils';
import { Plus, Check, X, Info } from 'lucide-react';

// Constants
const RING_RADIUS = 300;
const RING_THICKNESS = 40;
const YEAR_MINUTES = 365 * 24 * 60;

// Helper to convert date to angle (0 to 360)
const dateToAngle = (date: Date) => {
  const yearStart = startOfYear(date);
  const diff = differenceInMinutes(date, yearStart);
  return (diff / YEAR_MINUTES) * 360;
};

const angleToDate = (angle: number, year: number = new Date().getFullYear()) => {
  const yearStart = startOfYear(new Date(year, 0, 1));
  const minutes = (angle / 360) * YEAR_MINUTES;
  return addMinutes(yearStart, minutes);
};

export default function App() {
  const [zoom, setZoom] = useState(1);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [now, setNow] = useState(new Date(2026, 9, 21, 14, 0));
  const [showAddModal, setShowAddModal] = useState(false);
  const [isChangingTime, setIsChangingTime] = useState(false);
  const [completingTask, setCompletingTask] = useState<Task | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(prev => addMinutes(prev, 1));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleEarlyFinish = useCallback((task: Task) => {
    setTasks(prev => prev.map(t => t.id === task.id ? { 
      ...t, 
      status: 'EarlyFinish', 
      earlyFinishTime: new Date(2026, 9, 21, 14, 30) // Mock current time for early finish
    } : t));
  }, []);

  const handleAddTask = useCallback((task: Task) => {
    setTasks(prev => [...prev, task]);
    setShowAddModal(false);
  }, []);

  const handleCloseAddModal = useCallback(() => setShowAddModal(false), []);
  const handleCloseCompletionModal = useCallback(() => setCompletingTask(null), []);
  const handleTaskComplete = useCallback((id: string, success: boolean) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: success ? 'Completed' : 'Caution' } : t));
    setCompletingTask(null);
  }, []);

  const handleConfirmTime = useCallback((newTime: Date) => {
    setNow(newTime);
    setIsChangingTime(false);
  }, []);

  const handleCloseTimeModal = useCallback(() => setIsChangingTime(false), []);

  // Zoom handling
  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY;
    setZoom(prev => Math.min(Math.max(prev - delta * (prev * 0.005), 1), 1000));
  };

  const nowAngle = useMemo(() => dateToAngle(now), [now]);
  
  // Calculate layers for tasks to prevent overlap per category
  const layeredTasks = useMemo(() => {
    const categories: Task['category'][] = ['Personal', 'Work'];
    const result: (Task & { layer: number })[] = [];

    categories.forEach(cat => {
      const catTasks = tasks
        .filter(t => t.category === cat)
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      
      const layers: Date[][] = []; // Each element is an array of end times for tasks in that layer

      catTasks.forEach(task => {
        let assignedLayer = -1;
        for (let i = 0; i < layers.length; i++) {
          // Check if this task starts after all tasks in this layer end
          const lastEndTime = Math.max(...layers[i].map(d => d.getTime()));
          if (task.startTime.getTime() >= lastEndTime + 5 * 60000) {
            assignedLayer = i;
            layers[i].push(task.endTime);
            break;
          }
        }

        if (assignedLayer === -1) {
          assignedLayer = layers.length;
          layers.push([task.endTime]);
        }

        result.push({ ...task, layer: assignedLayer });
      });
    });

    return result;
  }, [tasks]);

  // Calculate rotation to keep 'Now' at the top when zoomed in
  const rotation = useMemo(() => {
    if (zoom <= 1) return 0;
    const targetRotation = -nowAngle;
    const factor = Math.min(1, (zoom - 1) / 5);
    return targetRotation * factor;
  }, [nowAngle, zoom]);

  return (
    <div 
      className="relative w-screen h-screen flex items-center justify-center overflow-hidden"
      onWheel={handleWheel}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-orbit-white" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-12 py-8 flex justify-between items-center pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="font-display text-3xl font-bold tracking-tighter text-slate-900">Aethel</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 font-medium">白金轨道版</p>
        </div>
        <button 
          onClick={() => setIsChangingTime(true)}
          className="glass-panel glass-edge px-6 py-3 rounded-full pointer-events-auto flex items-center gap-4 hover:scale-105 active:scale-95 transition-all group"
        >
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-orbit-cyan transition-colors">当前周期 (点击更改)</span>
            <span className="font-display text-sm font-bold">{format(now, 'HH:mm • yyyy年MM月dd日')}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <img src="https://picsum.photos/seed/aethel/100/100" alt="Profile" className="w-full h-full object-cover" />
          </div>
        </button>
      </header>

      {/* Orbit Container */}
      <motion.div 
        className="relative flex items-center justify-center"
        animate={{ 
          scale: zoom,
          rotate: rotation
        }}
        transition={{ type: 'spring', stiffness: 100, damping: 25, mass: 0.5 }}
      >
        <OrbitRing 
          tasks={layeredTasks} 
          nowAngle={nowAngle} 
          zoom={zoom} 
          now={now}
          onTaskClick={(task) => setCompletingTask(task)} 
          handleEarlyFinish={handleEarlyFinish}
          onNowDoubleClick={() => setZoom(prev => prev === 1 ? 6 : 1)}
        />
      </motion.div>

      {/* UI Overlays */}
      <AnimatePresence>
        {completingTask && (
          <TaskCompletionModal 
            key="completion-modal"
            task={completingTask} 
            onClose={handleCloseCompletionModal}
            onComplete={handleTaskComplete}
          />
        )}
        {showAddModal && (
          <AddTaskModal 
            key="add-modal"
            onClose={handleCloseAddModal}
            onAdd={handleAddTask}
          />
        )}
        {isChangingTime && (
          <SetTimeModal 
            key="time-modal"
            currentTime={now}
            onClose={handleCloseTimeModal}
            onConfirm={handleConfirmTime}
          />
        )}
      </AnimatePresence>

      {/* Floating Controls */}
      <div className="fixed bottom-12 right-12 flex flex-col gap-4 items-end">
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all"
        >
          <Plus size={32} />
        </button>
      </div>

      {/* Zoom Indicator */}
      <div className="fixed bottom-12 left-12 glass-panel glass-edge px-4 py-2 rounded-full">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">缩放: {zoom.toFixed(1)}x</span>
      </div>
    </div>
  );
}

function OrbitRing({ tasks, nowAngle, zoom, now, onTaskClick, handleEarlyFinish, onNowDoubleClick }: { tasks: (Task & { layer: number })[], nowAngle: number, zoom: number, now: Date, onTaskClick: (t: Task) => void, handleEarlyFinish: (t: Task) => void, onNowDoubleClick: () => void }) {
  const markers = useMemo(() => {
    const items = [];
    
    // Month Scale (Ticks)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * 360;
      items.push(
        <div 
          key={`month-tick-${i}`}
          className="absolute w-[2px] h-4 bg-slate-400"
          style={{ 
            transform: `rotate(${angle}deg) translateY(-${RING_RADIUS + 12 + 8}px)`,
            opacity: Math.max(0.4, 1 - zoom / 50)
          }}
        />
      );
    }

    // Week Scale (Ticks)
    for (let i = 0; i < 52; i++) {
      const angle = (i / 52) * 360;
      items.push(
        <div 
          key={`week-tick-${i}`}
          className="absolute w-[1px] h-2 bg-slate-300"
          style={{ 
            transform: `rotate(${angle}deg) translateY(-${RING_RADIUS + 12 + 4}px)`,
            opacity: Math.max(0.2, 1 - zoom / 30)
          }}
        />
      );
    }

    // Month labels (always visible at low zoom)
    if (zoom < 30) {
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * 360 + (360 / 24); // Center label in month
        const monthName = `${i + 1}月`;
        items.push(
          <div 
            key={`month-${i}`}
            className="absolute flex flex-col items-center"
            style={{ 
              transform: `rotate(${angle}deg) translateY(-${RING_RADIUS + 55}px)`,
              opacity: Math.max(0, 1 - (zoom - 1) / 20)
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400/60">{monthName}</span>
          </div>
        );
      }
    }

    // Day markers (fade in as we zoom)
    if (zoom > 3 && zoom < 150) {
      const dayInterval = zoom > 30 ? 1 : 5;
      for (let i = 0; i < 365; i += dayInterval) {
        const angle = (i / 365) * 360;
        const opacity = Math.min(1, (zoom - 3) / 10) * (zoom > 100 ? Math.max(0, 1 - (zoom - 100) / 50) : 1);
        items.push(
          <div 
            key={`day-${i}`}
            className="absolute w-[1px] h-4 bg-slate-200"
            style={{ 
              transform: `rotate(${angle}deg) translateY(-${RING_RADIUS + 20}px)`,
              opacity
            }}
          />
        );
      }
    }

    // Hour markers (fade in at high zoom)
    if (zoom > 20) {
      const totalHours = 365 * 24;
      // To be efficient, only render hours near "Now" when zoomed in
      const currentHourOfYear = Math.floor(differenceInMinutes(now, startOfYear(now)) / 60);
      const range = Math.ceil(500 / zoom); // Show fewer hours as we zoom in more
      
      for (let i = currentHourOfYear - range; i < currentHourOfYear + range; i++) {
        const angle = (i / totalHours) * 360;
        const opacity = Math.min(1, (zoom - 20) / 20);
        const isMainHour = i % 24 === 0;
        
        items.push(
          <div 
            key={`hour-${i}`}
            className={cn("absolute flex flex-col items-center", isMainHour ? "w-[2px] h-6 bg-slate-300" : "w-[1px] h-4 bg-slate-200")}
            style={{ 
              transform: `rotate(${angle}deg) translateY(-${RING_RADIUS + 25}px)`,
              opacity
            }}
          >
            {zoom > 80 && i % 3 === 0 && (
              <span className="text-[8px] font-bold text-slate-400 mt-8 rotate-[-0deg]">
                {format(addMinutes(startOfYear(now), i * 60), 'HH:mm')}
              </span>
            )}
          </div>
        );
      }
    }

    // Minute markers (very high zoom)
    if (zoom > 150) {
      const totalMinutes = YEAR_MINUTES;
      const currentMinuteOfYear = Math.floor(differenceInMinutes(now, startOfYear(now)));
      const range = Math.ceil(1000 / zoom);
      
      for (let i = currentMinuteOfYear - range; i < currentMinuteOfYear + range; i++) {
        if (i % 5 !== 0) continue; // Only every 5 mins for performance
        const angle = (i / totalMinutes) * 360;
        const opacity = Math.min(1, (zoom - 150) / 100);
        
        items.push(
          <div 
            key={`min-${i}`}
            className="absolute w-[0.5px] h-2 bg-slate-100"
            style={{ 
              transform: `rotate(${angle}deg) translateY(-${RING_RADIUS + 15}px)`,
              opacity
            }}
          />
        );
      }
    }

    return items;
  }, [zoom, now]);

  return (
    <div className="relative w-[800px] h-[800px] flex items-center justify-center">

      {/* Main Ring Structure */}
      <div 
        className="absolute rounded-full border-[24px] border-white z-10 pointer-events-none"
        style={{ 
          width: (RING_RADIUS + 12) * 2, 
          height: (RING_RADIUS + 12) * 2,
          filter: 'drop-shadow(0 60px 120px rgba(0,0,0,0.15)) drop-shadow(0 20px 40px rgba(0,0,0,0.1))'
        }}
      >
        {/* Inner and Outer High-Definition Edges */}
        <div className="absolute inset-[-1px] rounded-full border border-slate-200/40" />
        <div className="absolute inset-[23px] rounded-full border border-slate-200/40" />
        
        {/* Subtle Metallic/Glass Sheen (only on the ring surface) */}
        <div 
          className="absolute inset-0 rounded-full border-[24px] border-white/20 opacity-30"
          style={{ 
            maskImage: 'radial-gradient(circle, transparent 91%, black 92%)',
            WebkitMaskImage: 'radial-gradient(circle, transparent 91%, black 92%)'
          }}
        />
      </div>

      {/* Central Year Display */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <span className="font-display text-[120px] font-black text-slate-900/5 tracking-tighter select-none">
            {format(now, 'yyyy')}
          </span>
          <div className="h-[1px] w-12 bg-slate-200 -mt-8 opacity-50" />
        </motion.div>
      </div>

      {/* Markers */}
      {markers}

      {/* Task Arcs */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ overflow: 'visible' }}>
        <g transform="translate(400, 400)">
          {tasks.map(task => (
            <g key={task.id}>
              <TaskArc task={task} layer={task.layer} zoom={zoom} onClick={() => onTaskClick(task)} onDoubleClick={() => handleEarlyFinish(task)} />
            </g>
          ))}
        </g>
      </svg>

      {/* Now Indicator */}
      <motion.div 
        className="absolute flex flex-col items-center z-40 cursor-pointer pointer-events-auto"
        onDoubleClick={onNowDoubleClick}
        style={{ 
          transform: `rotate(${nowAngle}deg) translateY(-${RING_RADIUS}px)`,
        }}
      >
        <div className="w-[3px] h-48 bg-gradient-to-b from-red-500 via-red-500/50 to-transparent shadow-[0_0_20px_rgba(239,68,68,0.5)]" />
        <motion.div 
          animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mt-4 glass-panel glass-edge px-5 py-2 rounded-full whitespace-nowrap shadow-2xl border-red-100/20"
        >
          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">现在 {format(now, 'HH:mm MM月dd日')}</span>
        </motion.div>
        <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)] mt-2 border-2 border-white" />
      </motion.div>
    </div>
  );
}

function TaskArc({ task, layer, zoom, onClick, onDoubleClick }: { task: Task, layer: number, zoom: number, onClick: () => void, onDoubleClick: () => void }) {
  const startAngle = dateToAngle(task.startTime);
  const endAngle = dateToAngle(task.endTime);
  const earlyAngle = task.earlyFinishTime ? dateToAngle(task.earlyFinishTime) : null;
  
  const baseColor = task.color || (task.category === 'Personal' ? 'var(--color-orbit-cyan)' : 'var(--color-orbit-gold)');
  const isCompleted = task.status === 'Completed';
  const activeColor = isCompleted ? '#0f172a' : task.status === 'Caution' ? 'var(--color-orbit-amber)' : baseColor;

  // Lane calculations: Personal Outside (beyond scales), Work Inside
  const visualLaneWidth = 12; 
  const visualMargin = 22; // Reduced margin to be as close as possible to the 328px tick limit
  
  const offset = (task.category === 'Personal' ? visualMargin : 16) + (layer * visualLaneWidth);
  // Ring outer edge is at 312, inner edge is at 288
  const radius = task.category === 'Personal' ? 312 + offset : 288 - offset;
  
  const getPath = (s: number, e: number) => {
    const d = e - s;
    const largeArc = d > 180 ? 1 : 0;
    const x1 = radius * Math.cos((s - 90) * (Math.PI / 180));
    const y1 = radius * Math.sin((s - 90) * (Math.PI / 180));
    const x2 = radius * Math.cos((e - 90) * (Math.PI / 180));
    const y2 = radius * Math.sin((e - 90) * (Math.PI / 180));
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const mainPath = task.status === 'EarlyFinish' && earlyAngle 
    ? getPath(startAngle, earlyAngle)
    : getPath(startAngle, endAngle);

  const strokeWidth = 10 / zoom;

  return (
    <g 
      className="pointer-events-auto cursor-pointer group" 
      onClick={onClick} 
      onDoubleClick={onDoubleClick}
    >
      {/* Apple-style Liquid Glass: Soft Outer Glow */}
      <path 
        d={mainPath}
        fill="none"
        stroke={activeColor}
        strokeWidth={strokeWidth * 1.5}
        strokeLinecap="round"
        className={cn(
          "transition-opacity group-hover:opacity-20",
          isCompleted ? "opacity-5 blur-[2px]" : "opacity-10 blur-[4px]"
        )}
      />
      
      {/* Apple-style Liquid Glass: Frosted Base */}
      <path 
        d={mainPath}
        fill="none"
        stroke={activeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className={cn(
          isCompleted ? "opacity-20" : "opacity-30"
        )}
      />

      {/* Apple-style Liquid Glass: High-Definition Core */}
      <path 
        d={mainPath}
        fill="none"
        stroke={activeColor}
        strokeWidth={strokeWidth * 0.4}
        strokeLinecap="round"
        className={cn(
          "transition-all duration-700 ease-out",
          isCompleted ? "opacity-60" : "opacity-90",
          task.status === 'Caution' && "animate-pulse",
          task.status === 'EarlyFinish' && "stroke-orbit-green"
        )}
      />

      {/* Apple-style Liquid Glass: Inner Specular Edge (Top-side highlight) */}
      <path 
        d={mainPath}
        fill="none"
        stroke="white"
        strokeWidth={strokeWidth * 0.15}
        strokeLinecap="round"
        className={cn(
          "translate-y-[-0.5px] blur-[0.5px]",
          isCompleted ? "opacity-40" : "opacity-50"
        )}
      />

      {/* Early Finish Ghostly Trail */}
      {task.status === 'EarlyFinish' && earlyAngle && (
        <path 
          d={getPath(earlyAngle, endAngle)}
          fill="none"
          stroke={baseColor}
          strokeWidth={strokeWidth * 0.5}
          strokeLinecap="round"
          className="opacity-5 blur-[1px]"
          strokeDasharray={`${1/zoom} ${3/zoom}`}
        />
      )}
    </g>
  );
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', damping: 25, stiffness: 300 }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95, 
    y: 10,
    transition: { duration: 0.2 }
  }
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

const TaskCompletionModal = memo(({ task, onClose, onComplete }: { task: Task, onClose: () => void, onComplete: (id: string, success: boolean) => void }) => {
  return (
    <motion.div 
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/10 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div 
        variants={modalVariants}
        className="glass-panel glass-edge p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl flex flex-col items-center text-center gap-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
          <Info className="text-slate-400" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">任务已完成？</h2>
          <p className="text-sm text-slate-500 mt-2">{task.title}</p>
        </div>
        <div className="flex gap-4 w-full">
          <button 
            onClick={() => onComplete(task.id, false)}
            className="flex-1 py-4 rounded-2xl bg-slate-50 text-slate-900 font-bold text-sm hover:bg-slate-100 transition-colors"
          >
            否
          </button>
          <button 
            onClick={() => onComplete(task.id, true)}
            className="flex-1 py-4 rounded-2xl bg-slate-900 text-white font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            是
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});

const AddTaskModal = memo(({ onClose, onAdd }: { onClose: () => void, onAdd: (t: Task) => void }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Personal' | 'Work'>('Work');
  const [startTime, setStartTime] = useState(format(new Date(2026, 9, 21, 15, 0), "yyyy-MM-dd'T'HH:mm"));
  const [endTime, setEndTime] = useState(format(new Date(2026, 9, 21, 17, 0), "yyyy-MM-dd'T'HH:mm"));
  const [selectedColor, setSelectedColor] = useState<string | undefined>(undefined);

  const colors = [
    { name: 'Cyan', value: '#00fbfb' },
    { name: 'Gold', value: '#fcd400' },
    { name: 'Rose', value: '#ff4d6d' },
    { name: 'Indigo', value: '#4361ee' },
    { name: 'Amber', value: '#fb8500' },
    { name: 'Emerald', value: '#06d6a0' },
  ];

  return (
    <motion.div 
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        variants={modalVariants}
        className="glass-panel glass-edge p-10 rounded-[3rem] w-full max-w-md shadow-2xl flex flex-col gap-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="font-display text-2xl font-bold text-slate-900">新建轨道</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">任务标题</label>
            <input 
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="任务目标是什么？"
              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-orbit-cyan transition-all outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">开始时间</label>
              <input 
                type="datetime-local" 
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-orbit-cyan transition-all outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">结束时间</label>
              <input 
                type="datetime-local" 
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-orbit-cyan transition-all outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">类别</label>
            <div className="flex gap-3">
              {([['Work', '工作'], ['Personal', '个人']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-xs transition-all",
                    category === key ? "bg-slate-900 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">轨道颜色</label>
            <div className="flex flex-wrap gap-3">
              {colors.map(color => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color.value)}
                  className={cn(
                    "w-10 h-10 rounded-full transition-all border-2",
                    selectedColor === color.value ? "border-slate-900 scale-110 shadow-lg" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
              <button
                onClick={() => setSelectedColor(undefined)}
                className={cn(
                  "w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center transition-all border-2",
                  selectedColor === undefined ? "border-slate-900 scale-110 shadow-lg" : "border-transparent hover:scale-105"
                )}
                title="Default"
              >
                <div className="w-1 h-4 bg-slate-300 rotate-45" />
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={() => {
            if (!title) return;
            onAdd({
              id: Math.random().toString(36).substr(2, 9),
              title,
              category,
              status: 'Active',
              startTime: new Date(startTime),
              endTime: new Date(endTime),
              color: selectedColor
            });
          }}
          className="w-full py-5 rounded-3xl bg-slate-900 text-white font-bold text-sm shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
        >
          初始化轨道
        </button>
      </motion.div>
    </motion.div>
  );
});

const SetTimeModal = memo(({ currentTime, onClose, onConfirm }: { currentTime: Date, onClose: () => void, onConfirm: (d: Date) => void }) => {
  const [time, setTime] = useState(format(currentTime, "yyyy-MM-dd'T'HH:mm"));

  return (
    <motion.div 
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        variants={modalVariants}
        className="glass-panel glass-edge p-10 rounded-[3rem] w-full max-w-md shadow-2xl flex flex-col gap-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="font-display text-2xl font-bold text-slate-900">时间旅行</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">目标周期</label>
            <input 
              type="datetime-local" 
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-orbit-cyan transition-all outline-none"
            />
          </div>
        </div>

        <button 
          onClick={() => onConfirm(new Date(time))}
          className="w-full py-5 rounded-3xl bg-slate-900 text-white font-bold text-sm shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
        >
          跳转到该周期
        </button>
      </motion.div>
    </motion.div>
  );
});
