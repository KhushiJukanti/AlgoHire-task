import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { createBatch } from '@/src/lib/api';
import { AppLayout } from '@/src/components/shared/AppLayout';
import { FormField } from '@/src/components/shared/FormField';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

export function NewBatchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [course, setCourse] = useState('');
  const [errors, setErrors] = useState<{ title?: string; course?: string }>({});

  const createMutation = useMutation({
    mutationFn: createBatch,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success('Draft batch created. Add candidates to submit for review.');
      navigate(`/batches/${created._id}`, { replace: true });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Unable to create batch');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { title?: string; course?: string } = {};
    if (!title.trim()) nextErrors.title = 'Batch title is required.';
    if (!course.trim()) nextErrors.course = 'Course name is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    createMutation.mutate({ title: title.trim(), course: course.trim() });
  };

  return (
    <AppLayout
      title="Create New Batch"
      subtitle="Save a draft batch first, then import or enter the candidate roster before submitting."
      actions={
        <Button variant="outline" asChild>
          <Link to="/batches">
            <ArrowLeft className="h-4 w-4" />
            Back to Batches
          </Link>
        </Button>
      }
    >
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Batch Details</CardTitle>
            <CardDescription>
              Provide a descriptive title and the certified skilling course name.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <FormField
                id="batch-title"
                label="Batch Title"
                required
                helperText="Example: Solar PV Technician — Q1 2026 Cohort A"
                error={errors.title}
              >
                <Input
                  id="batch-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
                  }}
                  placeholder="Enter batch title"
                  disabled={createMutation.isPending}
                />
              </FormField>

              <FormField
                id="batch-course"
                label="Course"
                required
                helperText="Official skilling course or qualification pack name"
                error={errors.course}
              >
                <Input
                  id="batch-course"
                  value={course}
                  onChange={(e) => {
                    setCourse(e.target.value);
                    if (errors.course) setErrors((prev) => ({ ...prev, course: undefined }));
                  }}
                  placeholder="Enter course name"
                  disabled={createMutation.isPending}
                />
              </FormField>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  <Save className="h-4 w-4" />
                  {createMutation.isPending ? 'Saving Draft...' : 'Save Draft & Continue'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link to="/batches">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
