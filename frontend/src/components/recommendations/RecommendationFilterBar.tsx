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
        <div className="flex items-center justify-between px-6 py-3 bg-[#F9FEFF] rounded-xl shadow border border-[#233E7D]/20 mb-6">
            <div className="flex items-center space-x-4 flex-1 overflow-x-auto">
                {/* Resource Type */}
                <div className="min-w-[180px]">
                    <Select
                        value={filters.resourceType}
                        onValueChange={(value) => setFilters(prev => ({
                            ...prev,
                            resourceType: value,
                            resourceId: undefined
                        }))}
                    >
                        <SelectTrigger className="h-9 bg-[#EAF1FB] text-[#233E7D] text-xs font-semibold border-[#B6C6E3] focus:ring-2 focus:ring-[#233E7D]/40 hover:bg-[#D6E4F7]">
                            <SelectValue placeholder="Resource Type" />
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

                {/* Resource ID Toggle */}
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/50 rounded-lg border border-[#233E7D]/10">
                    <Switch
                        id="resource-id-toggle"
                        checked={filters.resourceIdEnabled}
                        onCheckedChange={handleResourceIdToggle}
                        className="data-[state=checked]:bg-[#233E7D]"
                    />
                    <Label htmlFor="resource-id-toggle" className="text-xs font-medium text-[#233E7D] cursor-pointer whitespace-nowrap">
                        Specific Resource
                    </Label>
                </div>

                {/* Resource ID Dropdown - Only show when enabled */}
                {filters.resourceIdEnabled && (
                    <div className="min-w-[220px]">
                        <Select
                            value={filters.resourceId || ""}
                            onValueChange={(value) => setFilters(prev => ({ ...prev, resourceId: value }))}
                            disabled={loadingResourceIds || !filters.resourceType}
                        >
                            <SelectTrigger className="h-9 bg-[#EAF1FB] text-[#233E7D] text-xs font-semibold border-[#B6C6E3] focus:ring-2 focus:ring-[#233E7D]/40 hover:bg-[#D6E4F7]">
                                <SelectValue placeholder={loadingResourceIds ? "Loading..." : "Select Resource"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {resourceIds.length === 0 ? (
                                    <div className="p-2 text-xs text-gray-500">No resources found</div>
                                ) : (
                                    resourceIds.map((resource) => (
                                        <SelectItem
                                            key={resource.resource_id}
                                            value={resource.resource_id}
                                            title={resource.resource_id}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium text-xs">{resource.resource_name}</span>
                                                <span className="text-[10px] text-gray-500 truncate max-w-md">
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

                {/* Date Range Preset */}
                <div className="min-w-[160px]">
                    <Select
                        value={filters.dateRangePreset}
                        onValueChange={(value) => handleDateRangePresetChange(value as DateRangePreset)}
                    >
                        <SelectTrigger className="h-9 bg-[#EAF1FB] text-[#233E7D] text-xs font-semibold border-[#B6C6E3] focus:ring-2 focus:ring-[#233E7D]/40 hover:bg-[#D6E4F7]">
                            <SelectValue placeholder="Date Range" />
                        </SelectTrigger>
                        <SelectContent>
                            {DATE_RANGE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Custom Date Pickers - Only show when Custom is selected */}
                {filters.dateRangePreset === 'custom' && (
                    <>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-9 w-[140px] justify-start text-xs bg-[#EAF1FB] text-[#233E7D] font-semibold border-[#B6C6E3] hover:bg-[#D6E4F7]",
                                        !filters.startDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                                    {filters.startDate ? format(filters.startDate, "MMM d, yy") : "Start Date"}
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

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        "h-9 w-[140px] justify-start text-xs bg-[#EAF1FB] text-[#233E7D] font-semibold border-[#B6C6E3] hover:bg-[#D6E4F7]",
                                        !filters.endDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                                    {filters.endDate ? format(filters.endDate, "MMM d, yy") : "End Date"}
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
                    <div className="text-xs text-[#233E7D] bg-white/70 px-3 py-1.5 rounded-md border border-[#233E7D]/10 whitespace-nowrap">
                        {format(filters.startDate, "MMM d")} - {format(filters.endDate, "MMM d, yyyy")}
                    </div>
                )}
            </div>

            {/* Run Analysis Button */}
            <Button
                onClick={onRunAnalysis}
                disabled={isLoading || !filters.resourceType || !filters.startDate || !filters.endDate}
                className="ml-4 h-9 px-6 text-xs font-bold bg-[#233E7D] hover:bg-[#1a2d5c] text-white shadow-sm whitespace-nowrap"
            >
                {isLoading ? 'Analyzing...' : 'Run Analysis'}
            </Button>
        </div>
    );
};

export default RecommendationFilterBar;
