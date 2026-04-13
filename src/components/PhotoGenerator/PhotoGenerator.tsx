"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SingleMode } from "./SingleMode";
import { BatchMode } from "./BatchMode";
import { HistoryMode } from "./HistoryMode";
import { Sparkles, Layers, History } from "lucide-react";

export function PhotoGenerator() {
  return (
    <Tabs defaultValue="single">
      <TabsList className="mb-6">
        <TabsTrigger value="single" className="gap-2">
          <Sparkles className="h-4 w-4" /> Individual
        </TabsTrigger>
        <TabsTrigger value="batch" className="gap-2">
          <Layers className="h-4 w-4" /> Lote
        </TabsTrigger>
        <TabsTrigger value="history" className="gap-2">
          <History className="h-4 w-4" /> Historial
        </TabsTrigger>
      </TabsList>

      <TabsContent value="single">
        <SingleMode />
      </TabsContent>
      <TabsContent value="batch">
        <BatchMode />
      </TabsContent>
      <TabsContent value="history">
        <HistoryMode />
      </TabsContent>
    </Tabs>
  );
}
