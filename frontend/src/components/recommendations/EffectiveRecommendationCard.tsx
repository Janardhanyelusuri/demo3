import React from 'react';
import { Lightbulb } from 'lucide-react';
import { NormalizedRecommendation } from "@/types/recommendations";

interface EffectiveRecommendationCardProps {
    recommendation: NormalizedRecommendation;
}

const EffectiveRecommendationCard: React.FC<EffectiveRecommendationCardProps> = ({ recommendation: rec }) => {
    const effective = rec.effectiveRecommendation;

    return (
        <div className="p-3 border-l-4 border-purple-500 rounded-lg shadow-md bg-white transition-shadow hover:shadow-lg">
            <div className="flex items-center space-x-2 mb-2">
                <Lightbulb className="w-4 h-4 text-purple-600" />
                <h3 className="text-sm font-semibold text-gray-800">Primary Recommendation</h3>
            </div>

            {/* Recommendation Text */}
            <div className="mb-3">
                <p className="text-gray-700 text-xs leading-relaxed">
                    {effective.text}
                </p>
            </div>

            {/* Saving Percentage */}
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-2.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">Estimated Saving:</span>
                <span className="text-xl font-bold text-purple-600">
                    {effective.saving_pct}%
                </span>
            </div>
        </div>
    );
};

export default EffectiveRecommendationCard;