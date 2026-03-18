'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function SkeletonLoader() {
  return (
    <Card className="animate-skeleton">
      <CardHeader className="pb-2">
        <div className="h-6 bg-muted rounded w-3/4" />
        <div className="h-4 bg-muted rounded w-1/2 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] bg-muted rounded mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
          <div className="h-4 bg-muted rounded w-4/6" />
        </div>
      </CardContent>
    </Card>
  );
}
