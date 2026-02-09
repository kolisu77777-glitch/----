const { useEffect, useState } = React;

const LockBodyScroll = () => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => document.body.style.overflow = 'auto';
    }, []);
    return null;
};

const Modal = ({ title, children, actions, onClose, type = 'info' }) => (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
        <LockBodyScroll />
        <div className={`bg-[#1a1a1a] border-2 ${type === 'danger' ? 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]' : type === 'success' ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-gray-600 shadow-[0_0_30px_rgba(0,0,0,0.8)]'} p-8 rounded-lg max-w-md w-full relative transform transition-all paper-texture`}>
            <h3 className={`text-2xl font-black mb-6 border-b pb-4 tracking-widest uppercase ${type === 'danger' ? 'text-red-500 border-red-900' : type === 'success' ? 'text-green-500 border-green-900' : 'text-white border-gray-700'}`}>{title}</h3>
            <div className="text-gray-300 mb-8 whitespace-pre-wrap font-mono text-sm leading-relaxed">{children}</div>
            <div className="flex justify-end gap-3">
                {actions ? actions : <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded font-bold text-sm border border-gray-600 transition-colors">关闭</button>}
            </div>
        </div>
    </div>
);

const GradeReveal = ({ grade, onComplete }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        const timer = setTimeout(onComplete, 4000);
        return () => clearTimeout(timer);
    }, []);

    let colorClass = "text-gray-500";
    if (grade === 'S') colorClass = "text-red-600 drop-shadow-[0_0_50px_rgba(220,38,38,1)]";
    else if (grade === 'A') colorClass = "text-yellow-500 drop-shadow-[0_0_50px_rgba(234,179,8,1)]";
    else if (grade === 'B') colorClass = "text-purple-500 drop-shadow-[0_0_50px_rgba(168,85,247,1)]";
    else if (grade === 'C') colorClass = "text-blue-500 drop-shadow-[0_0_50px_rgba(59,130,246,1)]";
    else if (grade === 'F') colorClass = "text-gray-400 drop-shadow-[0_0_50px_rgba(156,163,175,1)]";

    return (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center overflow-hidden">
            <LockBodyScroll />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800/30 via-black to-black"></div>
            <div className={`font-black transition-all duration-[1500ms] cubic-bezier(0.34, 1.56, 0.64, 1) transform ${visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-20'} ${colorClass}`} style={{fontSize: '20vw', fontFamily: 'Impact, sans-serif', lineHeight: 1}}>
                {grade}
            </div>
            <div className={`mt-8 text-white font-mono tracking-[1em] text-xl md:text-3xl uppercase transition-opacity duration-1000 delay-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
                CASE EVALUATION
            </div>
        </div>
    );
};

window.LockBodyScroll = LockBodyScroll;
window.Modal = Modal;
window.GradeReveal = GradeReveal;