// src/app/(main)/(projects)/connections/[projectName]/[cloudPlatform]/dashboards/azuredashboard/recommendations/page.tsx

"use client";

import React, { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { NormalizedRecommendation, RecommendationFilters, AZURE_RESOURCES } from "@/types/recommendations";
import { fetchRecommendationsWithFilters } from "@/lib/recommendations";
import { ChevronLeft, ChevronRight } from "lucide-react";
import axiosInstance, { BACKEND } from "@/lib/api";

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
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Generation counter: increments with each new analysis or reset
  // Only responses matching current generation are processed
  const generationRef = useRef<number>(0);
  // Store current task ID for optional backend cleanup
  const currentTaskIdRef = useRef<string | null>(null);

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

  // Backend cancellation using NEW non-auth endpoint for instant response
  const cancelBackendTask = async (projectIdToCancel: string) => {
    const cancelUrl = `${BACKEND}/cancel-tasks/${projectIdToCancel}`;
    console.log(`🔄 [NO-AUTH] Starting FAST cancel request: ${cancelUrl}`);

    try {
      // Use raw fetch() WITHOUT Authorization header to avoid CORS preflight
      // This ensures the fastest possible response time
      const response = await fetch(cancelUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      console.log(`✅ [NO-AUTH] Cancel request completed with status: ${response.status}`);
      console.log(`📊 [NO-AUTH] Backend response:`, data);
      console.log(`🛑 [NO-AUTH] Cancelled ${data.cancelled_count} tasks for project ${projectIdToCancel}`);
    } catch (error: any) {
      console.error(`❌ [NO-AUTH] Cancel request failed:`, error);
      // Don't throw - we still want to clear the UI even if cancel fails
    }
  };

  const handleFetch = async () => {
    // Increment generation - this invalidates all previous requests
    generationRef.current += 1;
    const thisGeneration = generationRef.current;

    console.log(`🚀 [RESET-v4.0-NO-AUTH] Starting analysis (generation ${thisGeneration})`);

    // Validation
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

    // Cancel previous backend task (non-blocking with keepalive)
    if (currentTaskIdRef.current) {
      cancelBackendTask(projectId);
      currentTaskIdRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setCurrentIndex(0);

    try {
      const result = await fetchRecommendationsWithFilters(
        projectId,
        cloudPlatform,
        filters,
        undefined // No abort signal needed
      );

      // CRITICAL: Only process if this is still the current generation
      if (generationRef.current !== thisGeneration) {
        console.log(`⚠️  Ignoring response from old generation ${thisGeneration} (current: ${generationRef.current})`);
        return;
      }

      // Store task_id for cleanup
      if (result.taskId) {
        currentTaskIdRef.current = result.taskId;
        console.log(`📋 Task started: ${result.taskId}`);
      }

      setRecommendations(result.recommendations);
      console.log(`✅ Analysis complete (generation ${thisGeneration}): ${result.recommendations.length} recommendations`);
    } catch (err) {
      // Only show errors for current generation
      if (generationRef.current !== thisGeneration) {
        console.log(`⚠️  Ignoring error from old generation ${thisGeneration}`);
        return;
      }

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred while fetching recommendations.");
      }
    } finally {
      // Only clear loading if still current generation
      if (generationRef.current === thisGeneration) {
        setIsLoading(false);
      }
    }
  };

  // Reset: Increment generation + AWAIT backend cancel before clearing UI
  const handleReset = async () => {
    // Increment generation - this makes all in-flight requests obsolete
    generationRef.current += 1;

    // IMMEDIATELY stop loading indicator so user sees response
    setIsLoading(false);

    console.log(`🔄 [RESET-v4.0-NO-AUTH] Reset clicked (new generation: ${generationRef.current})`);

    // CRITICAL: AWAIT the cancel request to ensure it completes before state updates
    if (currentTaskIdRef.current || projectId) {
      await cancelBackendTask(projectId);  // Wait for it to complete!
      currentTaskIdRef.current = null;
      console.log(`✅ [DEBUG] Cancel request completed, now clearing UI...`);
    }

    // Clear UI AFTER cancel request completes
    setFilters({
      resourceType: resourceOptions[0]?.displayName || '',
      resourceId: undefined,
      resourceIdEnabled: false,
      dateRangePreset: 'last_month',
      startDate: undefined,
      endDate: undefined,
    });

    setRecommendations([]);
    setCurrentIndex(0);
    setError(null);
    setIsTransitioning(false);

    console.log(`✅ Reset complete - UI cleared, generation ${generationRef.current}`);
  };

  // Navigation functions for carousel with smooth transitions
  const handlePrevious = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
      setTimeout(() => setIsTransitioning(false), 100);
    }, 200);
  };

  const handleNext = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => Math.min(recommendations.length - 1, prev + 1));
      setTimeout(() => setIsTransitioning(false), 100);
    }, 200);
  };

  // Direct navigation from pagination dots with transition
  const handleDotClick = (index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), 100);
    }, 200);
  };

  // Get current recommendation
  const currentRecommendation = recommendations[currentIndex];

  return (
    <div className="p-4">
      {/* FILTER BAR UI - Moved to top, removed title */}
      <RecommendationFilterBar
        filters={filters}
        setFilters={setFilters}
        resourceOptions={resourceOptions}
        isLoading={isLoading}
        onRunAnalysis={handleFetch}
        onReset={handleReset}
        projectId={projectId}
        cloudPlatform={cloudPlatform}
      />

      {/* RESULTS DISPLAY */}
      {isLoading ? (
        <div className="p-6 text-center">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto mb-3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3 mx-auto"></div>
          </div>
          <p className="mt-3 text-sm text-gray-600">Analyzing {filters.resourceType} data...</p>
        </div>
      ) : error ? (
        <div className="p-5 text-center text-red-600 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-base font-semibold mb-1">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="p-6 text-center bg-gray-50 border rounded-lg shadow-sm">
          <p className="text-sm text-gray-700">
            No optimization opportunities found for the selected filters.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Try adjusting your date range or resource selection.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header with resource count and navigation - More Compact */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#F9FEFF] border border-[#233E7D]/20 rounded-lg shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                Found <span className="text-[#233E7D]">{recommendations.length}</span> resource
                {recommendations.length !== 1 ? 's' : ''} with recommendations
              </p>
              <p className="text-xs text-gray-600 mt-0.5 truncate">
                {filters.resourceIdEnabled && filters.resourceId
                  ? `Showing: ${filters.resourceId.split('/').pop()}`
                  : `All ${filters.resourceType} resources`}
              </p>
            </div>

            {/* Navigation Controls (only show if multiple recommendations) */}
            {recommendations.length > 1 && (
              <div className="flex items-center space-x-3 ml-4">
                <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
                  {currentIndex + 1} / {recommendations.length}
                </span>
                <div className="flex space-x-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNext}
                    disabled={currentIndex === recommendations.length - 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Display Current Recommendation Card with smooth transition */}
          {currentRecommendation && (
            <div
              className={`transition-all duration-500 ease-in-out transform ${
                isTransitioning
                  ? 'opacity-0 scale-95 translate-y-4'
                  : 'opacity-100 scale-100 translate-y-0'
              }`}
            >
              <RecommendationCard recommendation={currentRecommendation} />
            </div>
          )}

          {/* Pagination Dots (only show if multiple recommendations) */}
          {recommendations.length > 1 && (
            <div className="flex justify-center space-x-1.5 py-3">
              {recommendations.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  disabled={isTransitioning}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'w-6 bg-[#233E7D] shadow-md'
                      : 'w-1.5 bg-gray-300 hover:bg-gray-400 hover:scale-125'
                  } ${isTransitioning ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
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
