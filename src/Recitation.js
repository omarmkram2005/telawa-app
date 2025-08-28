import React, { useEffect } from 'react';
import annyang from 'annyang';

const Recitation = ({ page, onError }) => {
  useEffect(() => {
    if (annyang) {
      const commands = {
        '*text': (text) => {
          // هنا يمكنك معالجة النص المدخل
          // تحقق من الأخطاء وأضفها إلى السجل
          // مثال:
          const isCorrect = checkRecitation(text); // دالة تحقق
          if (!isCorrect) {
            onError(prev => [...prev, { text, page }]);
            // تشغيل صوت الخطأ
          }
        }
      };

      annyang.addCommands(commands);
      annyang.start();

      return () => {
        annyang.abort();
      };
    }
  }, [page, onError]);

  return (
    <div>
      <h2>ابدأ التلاوة</h2>
      {/* زر لتفعيل المايك */}
    </div>
  );
};

const checkRecitation = (text) => {
  // دالة للتحقق من النص المدخل
  return true; // أو false بناءً على التحقق
};

export default Recitation;
