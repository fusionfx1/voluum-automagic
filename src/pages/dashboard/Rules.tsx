import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { Json } from '@/integrations/supabase/types';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  RefreshCw,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface Rule {
  id: string;
  name: string;
  is_enabled: boolean;
  cooldown_minutes: number;
  conditions: Json;
  actions: Json;
  created_at: string;
  updated_at: string;
}

interface RuleFormData {
  name: string;
  is_enabled: boolean;
  cooldown_minutes: number;
  conditions: Json;
  actions: Json;
}

const RULE_TEMPLATES = {
  kill_no_conv: {
    name: 'Kill No-Conv Burn',
    conditions: {
      type: 'kill_no_conv',
      spend_gt: 50,
      conversions_eq: 0,
      lookback_minutes: 60
    },
    actions: {
      notify_line: true,
      pause_campaign: true
    }
  },
  roi_negative: {
    name: 'ROI Negative Sustained',
    conditions: {
      type: 'roi_negative',
      roi_lt: -20,
      lookback_minutes: 120
    },
    actions: {
      notify_line: true,
      pause_campaign: true
    }
  },
  epc_crash: {
    name: 'EPC Crash',
    conditions: {
      type: 'epc_crash',
      epc_drop_pct: 50,
      lookback_minutes: 60,
      baseline_days: 7
    },
    actions: {
      notify_line: true,
      pause_campaign: false
    }
  },
  cvr_drop: {
    name: 'CVR Drop',
    conditions: {
      type: 'cvr_drop',
      cvr_drop_pct: 30,
      lookback_minutes: 60,
      baseline_days: 7
    },
    actions: {
      notify_line: true,
      pause_campaign: false
    }
  }
};

export default function Rules() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formCooldown, setFormCooldown] = useState(60);
  const [formConditions, setFormConditions] = useState('{}');
  const [formActions, setFormActions] = useState('{}');
  const [formEnabled, setFormEnabled] = useState(true);

  const { data: rules, isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rules')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Rule[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (rule: Partial<Rule>) => {
      const { data, error } = await supabase
        .from('rules')
        .insert([rule])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rule created successfully');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to create rule: ${error.message}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Rule> & { id: string }) => {
      const { data, error } = await supabase
        .from('rules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rule updated successfully');
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to update rule: ${error.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      toast.success('Rule deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete rule: ${error.message}`);
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('rules')
        .update({ is_enabled })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
    onError: (error) => {
      toast.error(`Failed to toggle rule: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormName('');
    setFormCooldown(60);
    setFormConditions('{}');
    setFormActions('{}');
    setFormEnabled(true);
    setEditingRule(null);
    setSelectedTemplate('');
  };

  const handleTemplateChange = (template: string) => {
    setSelectedTemplate(template);
    if (template && RULE_TEMPLATES[template as keyof typeof RULE_TEMPLATES]) {
      const t = RULE_TEMPLATES[template as keyof typeof RULE_TEMPLATES];
      setFormName(t.name);
      setFormConditions(JSON.stringify(t.conditions, null, 2));
      setFormActions(JSON.stringify(t.actions, null, 2));
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormCooldown(rule.cooldown_minutes);
    setFormConditions(JSON.stringify(rule.conditions, null, 2));
    setFormActions(JSON.stringify(rule.actions, null, 2));
    setFormEnabled(rule.is_enabled);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    try {
      const conditions = JSON.parse(formConditions);
      const actions = JSON.parse(formActions);

      if (editingRule) {
        updateMutation.mutate({
          id: editingRule.id,
          name: formName,
          cooldown_minutes: formCooldown,
          conditions,
          actions,
          is_enabled: formEnabled
        });
      } else {
        createMutation.mutate({
          name: formName,
          cooldown_minutes: formCooldown,
          conditions,
          actions,
          is_enabled: formEnabled
        });
      }
    } catch (e) {
      toast.error('Invalid JSON in conditions or actions');
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rules</h1>
          <p className="text-muted-foreground">Configure automation rules for your campaigns</p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? 'Edit Rule' : 'Create New Rule'}
                </DialogTitle>
                <DialogDescription>
                  Configure conditions and actions for automated campaign management
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {!editingRule && (
                  <div className="space-y-2">
                    <Label>Start from template</Label>
                    <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kill_no_conv">Kill No-Conv Burn</SelectItem>
                        <SelectItem value="roi_negative">ROI Negative Sustained</SelectItem>
                        <SelectItem value="epc_crash">EPC Crash</SelectItem>
                        <SelectItem value="cvr_drop">CVR Drop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Kill No-Conv Burn"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cooldown">Cooldown (minutes)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    value={formCooldown}
                    onChange={(e) => setFormCooldown(parseInt(e.target.value) || 60)}
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum time between triggers for the same campaign
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conditions">Conditions (JSON)</Label>
                  <Textarea
                    id="conditions"
                    value={formConditions}
                    onChange={(e) => setFormConditions(e.target.value)}
                    className="font-mono text-sm min-h-[120px]"
                    placeholder='{"type": "kill_no_conv", "spend_gt": 50}'
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="actions">Actions (JSON)</Label>
                  <Textarea
                    id="actions"
                    value={formActions}
                    onChange={(e) => setFormActions(e.target.value)}
                    className="font-mono text-sm min-h-[80px]"
                    placeholder='{"notify_line": true, "pause_campaign": true}'
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled">Enabled</Label>
                  <Switch
                    id="enabled"
                    checked={formEnabled}
                    onCheckedChange={setFormEnabled}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSaving || !formName}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingRule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!isAdmin && (
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <p className="text-sm">You need admin access to create or modify rules.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : rules && rules.length > 0 ? (
          rules.map((rule) => (
            <Card key={rule.id} className={!rule.is_enabled ? 'opacity-60' : ''}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    {rule.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Cooldown: {rule.cooldown_minutes} minutes
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={rule.is_enabled ? 'success' : 'neutral'}>
                    {rule.is_enabled ? 'Active' : 'Disabled'}
                  </StatusBadge>
                  {isAdmin && (
                    <>
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={(checked) => 
                          toggleMutation.mutate({ id: rule.id, is_enabled: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this rule?')) {
                            deleteMutation.mutate(rule.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Conditions</Label>
                    <pre className="mt-1 p-3 rounded-lg bg-muted/50 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(rule.conditions, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Actions</Label>
                    <pre className="mt-1 p-3 rounded-lg bg-muted/50 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(rule.actions, null, 2)}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No rules configured</h3>
              <p className="text-muted-foreground mb-4">
                Create your first automation rule to get started
              </p>
              {isAdmin && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Rule
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
