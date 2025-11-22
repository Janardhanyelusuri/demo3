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

  // AbortController ref to cancel ongoing requests
  const abortControllerRef = useRef<AbortController | null>(null);
  // Task ID ref to cancel backend processing
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

  // Helper function to cancel backend task
  const cancelBackendTask = async (taskId: string) => {
    try {
      console.log(`🔄 Attempting to cancel backend task: ${taskId}`);
      console.log(`📡 Calling: ${BACKEND}/llm/tasks/${taskId}/cancel`);

      const response = await axiosInstance.post(`${BACKEND}/llm/tasks/${taskId}/cancel`);

      console.log(`✅ Cancelled backend task: ${taskId}`, response.data);
    } catch (error: any) {
      console.error('❌ Error cancelling backend task:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
    }
  };

  const handleFetch = async () => {
    console.log('🚀 [TASK-CANCEL-v2.0] NEW CODE LOADED - Task cancellation active');

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

    // Cancel any ongoing request and backend task before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (currentTaskIdRef.current) {
      await cancelBackendTask(currentTaskIdRef.current);
      currentTaskIdRef.current = null;
    }

    // Create a new AbortController for this request
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    setCurrentIndex(0); // Reset to first recommendation

    try {
      const result = await fetchRecommendationsWithFilters(
        projectId,
        cloudPlatform,
        filters,
        abortControllerRef.current.signal
      );

      // Store task_id immediately for potential cancellation
      if (result.taskId) {
        currentTaskIdRef.current = result.taskId;
        console.log(`📋 Started task: ${result.taskId}`);
        console.log(`✅ Task ID stored in currentTaskIdRef`);
      } else {
        console.warn('⚠️  No task_id received from backend');
      }

      setRecommendations(result.recommendations);
    } catch (err) {
      // Robust error handling
      if (err instanceof Error) {
        // Don't show error message if request was cancelled
        if (err.message !== 'Analysis cancelled') {
          setError(err.message);
        }
      } else {
        setError("An unknown error occurred while fetching recommendations.");
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      // Only clear task_id if no longer needed
      if (currentTaskIdRef.current) {
        // Keep task_id for a moment in case of late cancellation
        setTimeout(() => {
          currentTaskIdRef.current = null;
        }, 1000);
      }
    }
  };

  // Reset all filters and clear results
  const handleReset = async () => {
    console.log('🔄 [TASK-CANCEL-v2.0] Reset clicked - Cancelling tasks');

    // DON'T abort the HTTP request - this was blocking the cancel request
    // Instead, just send the cancel request to backend and ignore the LLM response when it comes
    // if (abortControllerRef.current) {
    //   console.log('✋ Aborting HTTP request...');
    //   abortControllerRef.current.abort();
    //   abortControllerRef.current = null;
    // }

    // Store task/project IDs before clearing
    const taskIdToCancel = currentTaskIdRef.current;
    const projectIdForCancel = projectId;

    // Clear task_id immediately
    currentTaskIdRef.current = null;

    // Send cancel request to backend IMMEDIATELY (no delay needed since we're not aborting)
    if (taskIdToCancel) {
      // We have a specific task_id - cancel that task
      console.log(`🎯 Cancelling backend task: ${taskIdToCancel}`);
      cancelBackendTask(taskIdToCancel);
    } else {
      // No task_id available (request was sent too recently)
      // Cancel all tasks for this project as a fallback
      console.log(`🎯 No task_id - cancelling all tasks for project ${projectIdForCancel}`);

      // Use fetch instead of axios to avoid any interceptor interference
      const token = localStorage.getItem("accessToken");
      console.log(`🔑 Using token: ${token ? token.substring(0, 20) + '...' : 'NO TOKEN'}`);
      console.log(`📡 Sending POST to: ${BACKEND}/llm/projects/${projectIdForCancel}/cancel-tasks`);

      fetch(`${BACKEND}/llm/projects/${projectIdForCancel}/cancel-tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        keepalive: true  // Ensure request completes even if page/component changes
      })
        .then(response => {
          console.log(`📡 Cancel response status: ${response.status}`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          console.log(`✅ Cancelled project tasks:`, data);
        })
        .catch(error => {
          console.error('❌ Error cancelling project tasks:', error);
          console.error('Error type:', error.name);
          console.error('Error message:', error.message);
        });
    }

    console.log('Resetting UI state...');

    // Reset filters to initial state
    setFilters({
      resourceType: resourceOptions[0]?.displayName || '',
      resourceId: undefined,
      resourceIdEnabled: false,
      dateRangePreset: 'last_month',
      startDate: undefined,
      endDate: undefined,
    });

    // Clear all state
    setRecommendations([]);
    setCurrentIndex(0);
    setError(null);
    setIsLoading(false);
    setIsTransitioning(false);

    console.log('✅ Reset complete - UI cleared');
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
