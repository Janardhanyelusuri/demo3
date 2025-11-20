// src/app/(main)/(projects)/connections/[projectName]/[cloudPlatform]/dashboards/azuredashboard/recommendations/page.tsx

"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { NormalizedRecommendation, RecommendationFilters, AZURE_RESOURCES } from "@/types/recommendations";
import { fetchRecommendationsWithFilters } from "@/lib/recommendations";
import { ChevronLeft, ChevronRight } from "lucide-react";

// NEW SHARED COMPONENT IMPORTS
import RecommendationFilterBar from "@/components/recommendations/RecommendationFilterBar";
import RecommendationCard from "@/components/recommendations/RecommendationCard";
import { Button } from "@/components/ui/button";

const AzureRecommendationsPage: React.FC = () => {
  const params = useParams();
  const projectId = params.projectName as string;
  const cloudPlatform = 'azure' as const;

  const [recommendations, setRecommendations] = useState<NormalizedRecommendation[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resourceOptions = AZURE_RESOURCES;

  // Initialize filters with default values including new properties
  const [filters, setFilters] = useState<RecommendationFilters>({
    resourceType: resourceOptions[0]?.displayName || '',
    resourceId: undefined,
    resourceIdEnabled: false, // New: toggle off by default
    dateRangePreset: 'last_month', // New: default to last month
    startDate: undefined,
    endDate: undefined,
  });

  const handleFetch = async () => {
    // Validation ensures analysis only runs if a resource type and dates are selected
    if (!filters.resourceType) {
        setError("Please select a Resource Type to analyze.");
        setRecommendations([]);
        return;
    }

    if (!filters.startDate || !filters.endDate) {
        setError("Please select a date range.");
        setRecommendations([]);
        return;
    }

    setIsLoading(true);
    setError(null);
    setCurrentIndex(0); // Reset to first recommendation

    try {
      const normalizedData = await fetchRecommendationsWithFilters(
        projectId,
        cloudPlatform,
        filters
      );
      setRecommendations(normalizedData);
    } catch (err) {
      // Robust error handling
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while fetching recommendations.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation functions for carousel
  const handlePrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(recommendations.length - 1, prev + 1));
  };

  // Get current recommendation
  const currentRecommendation = recommendations[currentIndex];

  return (
    <div className="p-8">
      <h1 className="text-cp-title-2xl font-cp-semibold mb-6 text-cp-blue">
        Azure Cost Optimization Recommendations
      </h1>

      {/* FILTER BAR UI (Uses shared component with new props) */}
      <RecommendationFilterBar
        filters={filters}
        setFilters={setFilters}
        resourceOptions={resourceOptions}
        isLoading={isLoading}
        onRunAnalysis={handleFetch}
        projectId={projectId}
        cloudPlatform={cloudPlatform}
      />

      {/* RESULTS DISPLAY */}
      {isLoading ? (
        <div className="p-8 text-center text-lg">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
          </div>
          <p className="mt-4">Analyzing {filters.resourceType} data...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg">
          <p className="text-lg font-semibold mb-2">Error</p>
          <p>{error}</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 border rounded-lg shadow-sm">
          <p className="text-cp-body text-gray-700">
            No optimization opportunities found for the selected filters.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Try adjusting your date range or resource selection.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header with resource count and navigation */}
          <div className="flex items-center justify-between p-4 bg-white border rounded-lg shadow-sm">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                Found <span className="text-blue-600">{recommendations.length}</span> resource
                {recommendations.length !== 1 ? 's' : ''} with recommendations
              </p>
              <p className="text-sm text-gray-600">
                {filters.resourceIdEnabled && filters.resourceId
                  ? `Showing analysis for: ${filters.resourceId.split('/').pop()}`
                  : `Showing all ${filters.resourceType} resources`}
              </p>
            </div>

            {/* Navigation Controls (only show if multiple recommendations) */}
            {recommendations.length > 1 && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Resource {currentIndex + 1} of {recommendations.length}
                </span>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={currentIndex === recommendations.length - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Display Current Recommendation Card */}
          {currentRecommendation && (
            <div className="transition-all duration-300 ease-in-out">
              <RecommendationCard recommendation={currentRecommendation} />
            </div>
          )}

          {/* Pagination Dots (only show if multiple recommendations) */}
          {recommendations.length > 1 && (
            <div className="flex justify-center space-x-2 py-4">
              {recommendations.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    index === currentIndex
                      ? 'w-8 bg-blue-600'
                      : 'w-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to resource ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AzureRecommendationsPage;
