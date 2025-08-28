import React from 'react';

const RecitationControl = ({ isRecording, onStartRecitation, onStopRecitation, currentVerse, progress }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full mr-3 ${isRecording ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                    <span className="text-lg font-medium">
                        {isRecording ? 'جاري التسجيل...' : 'جاهز للتسجيل'}
                    </span>
                </div>
                
                <div className="flex gap-3">
                    <button
                        onClick={onStartRecitation}
                        disabled={isRecording}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                        ▶ بدء التلاوة
                    </button>
                    <button
                        onClick={onStopRecitation}
                        disabled={!isRecording}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                        ⏹ إيقاف
                    </button>
                </div>
            </div>
            
            {currentVerse > 0 && (
                <div className="mt-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-blue-800 font-medium">
                            الآية الحالية: {currentVerse}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div 
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecitationControl;
