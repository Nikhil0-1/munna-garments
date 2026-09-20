import { motion } from 'framer-motion';

export default function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{background:'#FAF9F7'}}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-6"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            className="w-14 h-14 rounded-full border-4"
            style={{ borderColor: 'rgba(201,169,110,0.2)', borderTopColor: '#C9A96E' }}
          />
          <div className="absolute inset-2 rounded-full flex items-center justify-center" style={{background:'rgba(201,169,110,0.1)'}}>
            <span style={{fontSize:'18px'}}>✦</span>
          </div>
        </div>
        <div className="text-center">
          <p className="font-serif font-semibold" style={{color:'#8B7355',fontSize:'18px',letterSpacing:'0.05em'}}>MUNNA</p>
          <p style={{fontSize:'11px',color:'#B5A896',letterSpacing:'0.15em',marginTop:'2px'}}>READYMADE GARMENTS</p>
        </div>
      </motion.div>
    </div>
  );
}
