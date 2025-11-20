// src/components/recommendations/RecommendationFilterBar.tsx

import React, { useState, useEffect } from 'react';
import { RecommendationFilters, CloudResourceMap, DATE_RANGE_OPTIONS, DateRangePreset } from "@/types/recommendations";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { calculateDateRange } from "@/lib/dateUtils";
import axiosInstance, { BACKEND } from "@/lib/api";

// --- UI Imports (Shadcn/Radix components) ---
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ResourceIdOption {
    resource_id: string;
    resource_name: string;
}

interface RecommendationFilterBarProps {
    filters: RecommendationFilters;
    setFilters: React.Dispatch<React.SetStateAction<RecommendationFilters>>;
    resourceOptions: CloudResourceMap[];
    isLoading: boolean;
    onRunAnalysis: () => void;
    projectId: string;
    cloudPlatform: 'azure' | 'aws' | 'gcp';
}

const RecommendationFilterBar: React.FC<RecommendationFilterBarProps> = ({
    filters,
    setFilters,
    resourceOptions,
    isLoading,
    onRunAnalysis,
    projectId,
    cloudPlatform
}) => {
    const [resourceIds, setResourceIds] = useState<ResourceIdOption[]>([]);
    const [loadingResourceIds, setLoadingResourceIds] = useState(false);

    // Define the date boundaries to prevent future date selection
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch resource IDs when resource type changes
    useEffect(() => {
        if (!filters.resourceType || !filters.resourceIdEnabled) {
            setResourceIds([]);
            return;
        }

        const fetchResourceIds = async () => {
            setLoadingResourceIds(true);
            try {
                const resourceMap = resourceOptions.find(r => r.displayName === filters.resourceType);
                if (!resourceMap) return;

                const url = `${BACKEND}/llm/${cloudPlatform}/${projectId}/resources/${resourceMap.backendKey}`;
                const response = await axiosInstance.get(url);

                if (response.data.status === 'success') {
                    setResourceIds(response.data.resource_ids || []);
                }
            } catch (error) {
                console.error('Error fetching resource IDs:', error);
                setResourceIds([]);
            } finally {
                setLoadingResourceIds(false);
            }
        };

        fetchResourceIds();
    }, [filters.resourceType, filters.resourceIdEnabled, projectId, cloudPlatform, resourceOptions]);

    // Handle date range preset change
    const handleDateRangePresetChange = (preset: DateRangePreset) => {
        setFilters(prev => {
            const dateRange = calculateDateRange(preset);

            return {
                ...prev,
                dateRangePreset: preset,
                startDate: dateRange?.startDate,
                endDate: dateRange?.endDate
            };
        });
    };

    // Handle resource ID toggle
    const handleResourceIdToggle = (enabled: boolean) => {
        setFilters(prev => ({
            ...prev,
            resourceIdEnabled: enabled,
            resourceId: enabled ? prev.resourceId : undefined
        }));
    };

    return (
        <div className="flex flex-col space-y-4 p-6 mb-8 bg-white border rounded-lg shadow-sm">

            {/* First Row: Resource Type */}
            <div className="flex items-center space-x-4">
                <div className="w-full">
                    <Label htmlFor="resource-type" className="text-sm font-medium mb-2 block">
                        Resource Type *
                    </Label>
                    <Select
                        value={filters.resourceType}
                        onValueChange={(value) => setFilters(prev => ({
                            ...prev,
                            resourceType: value,
                            resourceId: undefined
                        }))}
                    >
                        <SelectTrigger id="resource-type" className="w-full">
                            <SelectValue placeholder="Select Resource Type" />
                        </SelectTrigger>
                        <SelectContent>
                            {resourceOptions.map((r) => (
                                <SelectItem key={r.backendKey} value={r.displayName}>
                                    {r.displayName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Second Row: Resource ID Toggle and Dropdown */}
            <div className="flex items-start space-x-4">
                <div className="flex items-center space-x-2 pt-8">
                    <Switch
                        id="resource-id-toggle"
                        checked={filters.resourceIdEnabled}
                        onCheckedChange={handleResourceIdToggle}
                    />
                    <Label htmlFor="resource-id-toggle" className="text-sm font-medium cursor-pointer">
                        Filter by specific resource
                    </Label>
                </div>

                {filters.resourceIdEnabled && (
                    <div className="flex-1">
                        <Label htmlFor="resource-id" className="text-sm font-medium mb-2 block">
                            Resource ID
                        </Label>
                        <Select
                            value={filters.resourceId || ""}
                            onValueChange={(value) => setFilters(prev => ({ ...prev, resourceId: value }))}
                            disabled={loadingResourceIds || !filters.resourceType}
                        >
                            <SelectTrigger id="resource-id" className="w-full">
                                <SelectValue placeholder={loadingResourceIds ? "Loading resources..." : "Select Resource ID"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {resourceIds.length === 0 ? (
                                    <div className="p-2 text-sm text-gray-500">No resources found</div>
                                ) : (
                                    resourceIds.map((resource) => (
                                        <SelectItem
                                            key={resource.resource_id}
                                            value={resource.resource_id}
                                            title={resource.resource_id}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">{resource.resource_name}</span>
                                                <span className="text-xs text-gray-500 truncate max-w-md">
                                                    {resource.resource_id}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Third Row: Date Range */}
            <div className="flex flex-col space-y-2">
                <Label htmlFor="date-range" className="text-sm font-medium">
                    Date Range *
                </Label>
                <div className="flex items-center space-x-4 flex-wrap gap-2">
                    {/* Date Range Preset Dropdown */}
                    <Select
                        value={filters.dateRangePreset}
                        onValueChange={(value) => handleDateRangePresetChange(value as DateRangePreset)}
                    >
                        <SelectTrigger id="date-range" className="w-[200px]">
                            <SelectValue placeholder="Select Date Range" />
                        </SelectTrigger>
                        <SelectContent>
                            {DATE_RANGE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Custom Date Pickers - Only show when Custom is selected */}
                    {filters.dateRangePreset === 'custom' && (
                        <>
                            {/* Start Date Picker */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[200px] justify-start text-left font-normal",
                                            !filters.startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {filters.startDate ? format(filters.startDate, "PPP") : <span>Start Date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={filters.startDate}
                                        onSelect={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                                        initialFocus
                                        disabled={(date) => date > today}
                                    />
                                </PopoverContent>
                            </Popover>

                            {/* End Date Picker */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[200px] justify-start text-left font-normal",
                                            !filters.endDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {filters.endDate ? format(filters.endDate, "PPP") : <span>End Date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={filters.endDate}
                                        onSelect={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
                                        initialFocus
                                        disabled={(date) =>
                                           date > today ||
                                           (filters.startDate ? date < filters.startDate : false)
                                        }
                                    />
                                </PopoverContent>
                            </Popover>
                        </>
                    )}

                    {/* Display selected date range for non-custom presets */}
                    {filters.dateRangePreset !== 'custom' && filters.startDate && filters.endDate && (
                        <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
                            {format(filters.startDate, "MMM d, yyyy")} - {format(filters.endDate, "MMM d, yyyy")}
                        </div>
                    )}
                </div>
            </div>

            {/* Fourth Row: Run Analysis Button */}
            <div className="flex items-center justify-end pt-2">
                <Button
                    onClick={onRunAnalysis}
                    disabled={isLoading || !filters.resourceType || !filters.startDate || !filters.endDate}
                    className="px-8"
                    size="lg"
                >
                    {isLoading ? 'Analyzing...' : 'Run Analysis'}
                </Button>
            </div>
        </div>
    );
};

export default RecommendationFilterBar;
