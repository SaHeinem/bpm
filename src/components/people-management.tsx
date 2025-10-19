import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Papa from "papaparse";
import { z } from "zod";
import { Pencil, Plus, Trash2, UploadCloud, X, UserX, UserCheck } from "lucide-react";

import { useParticipants } from "@/hooks/use-participants";
import { useRestaurants } from "@/hooks/use-restaurants";
import { useAssignments } from "@/hooks/use-assignments";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";

const participantSchema = z.object({
  pretix_id: z.string().min(1, "Pretix ID is required"),
  given_name: z.string().min(1, "Given name is required"),
  family_name: z.string().min(1, "Family name is required"),
  attendee_name: z.string().min(1, "Attendee display name is required"),
  attendee_email: z.string().email("A valid email is required"),
  is_table_captain: z.boolean(),
  captain_phone: z.string().trim().min(1).optional(),
  captain_preferred_contact: z
    .enum(["email", "phone", "sms", "whatsapp", "telegram"])
    .optional(),
  status: z.enum(["registered", "cancelled", "late_joiner"]),
});

type ParticipantFormValues = z.infer<typeof participantSchema>;

type DialogMode = "create" | "edit";

interface ParticipantDialogState {
  open: boolean;
  mode: DialogMode;
  participantId?: string;
}

type ParticipantCsvRow = {
  pretix_id?: string;
  given_name?: string;
  family_name?: string;
  attendee_name?: string;
  attendee_email?: string;
  is_table_captain?: string | boolean;
  captain_phone?: string;
  captain_preferred_contact?: string;
  status?: string;
};

const initialParticipantValues: ParticipantFormValues = {
  pretix_id: "",
  given_name: "",
  family_name: "",
  attendee_name: "",
  attendee_email: "",
  is_table_captain: false,
  captain_phone: undefined,
  captain_preferred_contact: undefined,
  status: "registered",
};

type StatusFilter = "all" | ParticipantFormValues["status"];
type CaptainFilter = "all" | "captain" | "attendee";

const statusBadgeStyles: Record<ParticipantFormValues["status"], string> = {
  registered: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  late_joiner: "bg-warning/10 text-warning",
};

export function PeopleManagement() {
  const {
    participants,
    isLoading,
    createParticipant,
    editParticipant,
    removeParticipant,
    bulkImportParticipants,
  } = useParticipants();
  const { restaurants, editRestaurant } = useRestaurants();
  const { assignments, unassignMutation } = useAssignments();
  const { toast } = useToast();

  const [dialogState, setDialogState] = useState<ParticipantDialogState>({
    open: false,
    mode: "create",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [captainFilter, setCaptainFilter] = useState<CaptainFilter>("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantSchema),
    defaultValues: initialParticipantValues,
  });

  const restaurantById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants]
  );
  const assignmentByParticipant = useMemo(() => {
    const result: Record<string, string> = {};
    // Add regular assignments from the assignments table
    assignments.forEach((assignment) => {
      result[assignment.participant_id] = assignment.restaurant_id;
    });
    // Add captain assignments from restaurants table
    restaurants.forEach((restaurant) => {
      if (restaurant.assigned_captain_id) {
        result[restaurant.assigned_captain_id] = restaurant.id;
      }
    });
    return result;
  }, [assignments, restaurants]);

  const filteredParticipants = useMemo(() => {
    return participants.filter((participant) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        participant.attendee_name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        participant.attendee_email
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        participant.pretix_id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || participant.status === statusFilter;
      const matchesCaptain =
        captainFilter === "all" ||
        (captainFilter === "captain" && participant.is_table_captain) ||
        (captainFilter === "attendee" && !participant.is_table_captain);

      return matchesSearch && matchesStatus && matchesCaptain;
    });
  }, [participants, searchTerm, statusFilter, captainFilter]);

  const totalRegistered = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.status === "registered" ||
          participant.status === "late_joiner"
      ).length,
    [participants]
  );

  const totalCaptains = useMemo(
    () =>
      participants.filter(
        (participant) =>
          participant.is_table_captain && participant.status !== "cancelled"
      ).length,
    [participants]
  );

  const openDialog = (mode: DialogMode, participantId?: string) => {
    if (mode === "edit" && participantId) {
      const participant = participants.find(
        (item) => item.id === participantId
      );
      if (participant) {
        form.reset({
          pretix_id: participant.pretix_id,
          given_name: participant.given_name,
          family_name: participant.family_name,
          attendee_name: participant.attendee_name,
          attendee_email: participant.attendee_email,
          is_table_captain: participant.is_table_captain,
          captain_phone: participant.captain_phone ?? undefined,
          captain_preferred_contact:
            participant.captain_preferred_contact as ParticipantFormValues["captain_preferred_contact"],
          status: participant.status,
        });
      }
    } else {
      form.reset(initialParticipantValues);
    }
    setDialogState({ open: true, mode, participantId });
  };

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, open: false }));
  };

  const handleSubmit = async (values: ParticipantFormValues) => {
    try {
      if (dialogState.mode === "create") {
        await createParticipant.mutateAsync({
          pretix_id: values.pretix_id,
          given_name: values.given_name,
          family_name: values.family_name,
          attendee_name: values.attendee_name,
          attendee_email: values.attendee_email,
          is_table_captain: values.is_table_captain,
          captain_phone: values.captain_phone?.trim()
            ? values.captain_phone.trim()
            : null,
          captain_preferred_contact: values.captain_preferred_contact ?? null,
          status: values.status,
        });
        toast({
          title: "Participant added",
          description: `${values.attendee_name} has been added.`,
        });
      } else if (dialogState.mode === "edit" && dialogState.participantId) {
        await editParticipant.mutateAsync({
          id: dialogState.participantId,
          payload: {
            pretix_id: values.pretix_id,
            given_name: values.given_name,
            family_name: values.family_name,
            attendee_name: values.attendee_name,
            attendee_email: values.attendee_email,
            is_table_captain: values.is_table_captain,
            captain_phone: values.captain_phone?.trim()
              ? values.captain_phone.trim()
              : null,
            captain_preferred_contact: values.captain_preferred_contact ?? null,
            status: values.status,
          },
        });
        toast({
          title: "Participant updated",
          description: `${values.attendee_name}'s profile has been saved.`,
        });
      }
      closeDialog();
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to save participant",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (participantId: string) => {
    const participant = participants.find((item) => item.id === participantId);
    if (!participant) return;
    try {
      await removeParticipant.mutateAsync(participantId);
      toast({
        title: "Participant removed",
        description: `${participant.attendee_name} has been removed.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to remove participant",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (participantId: string) => {
    const participant = participants.find((item) => item.id === participantId);
    if (!participant) return;

    const newStatus = participant.status === "cancelled" ? "registered" : "cancelled";

    try {
      // Update participant status
      await editParticipant.mutateAsync({
        id: participantId,
        payload: {
          status: newStatus,
        },
      });

      // If cancelling, remove their assignment and captain assignment
      if (newStatus === "cancelled") {
        // Remove from assignments table (if they are a regular attendee)
        const assignment = assignmentByParticipant[participantId];
        if (assignment) {
          await unassignMutation.mutateAsync(participantId);
        }

        // Remove from restaurants table (if they are a captain)
        const captainRestaurant = restaurants.find(
          (r) => r.assigned_captain_id === participantId
        );
        if (captainRestaurant) {
          await editRestaurant.mutateAsync({
            id: captainRestaurant.id,
            payload: {
              assigned_captain_id: null,
            },
          });
        }
      }

      toast({
        title: newStatus === "cancelled" ? "Participant cancelled" : "Participant reactivated",
        description: `${participant.attendee_name} has been ${newStatus === "cancelled" ? "cancelled" : "reactivated"}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to update status",
        description:
          error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    event
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = await new Promise<Papa.ParseResult<ParticipantCsvRow>>(
        (resolve, reject) => {
          Papa.parse<ParticipantCsvRow>(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header: string) => header.trim().toLowerCase(),
            complete: resolve,
            error: reject,
          });
        }
      );

      if (parsed.errors.length > 0) {
        throw new Error(parsed.errors[0].message);
      }

      const payload = parsed.data
        .filter((row) => Boolean(row.pretix_id) && Boolean(row.attendee_email))
        .map((row) => ({
          pretix_id: String(row.pretix_id),
          given_name: row.given_name ? String(row.given_name) : "",
          family_name: row.family_name ? String(row.family_name) : "",
          attendee_name: row.attendee_name
            ? String(row.attendee_name)
            : `${row.given_name ?? ""} ${row.family_name ?? ""}`.trim(),
          attendee_email: String(row.attendee_email),
          is_table_captain:
            typeof row.is_table_captain === "boolean"
              ? row.is_table_captain
              : String(row.is_table_captain ?? "").toLowerCase() === "true",
          captain_phone: row.captain_phone ? String(row.captain_phone) : null,
          captain_preferred_contact: row.captain_preferred_contact
            ? String(row.captain_preferred_contact)
            : null,
          status:
            row.status &&
            ["registered", "cancelled", "late_joiner"].includes(
              String(row.status)
            )
              ? (String(row.status) as ParticipantFormValues["status"])
              : "registered",
        }));

      if (!payload.length) {
        toast({
          title: "No rows imported",
          description: "We could not find any valid rows in that CSV.",
        });
        return;
      }

      const result = await bulkImportParticipants.mutateAsync(payload);

      if (result.failed === 0) {
        toast({
          title: "Import successful",
          description: `${result.succeeded} participant${result.succeeded === 1 ? "" : "s"} imported successfully.`,
        });
      } else if (result.succeeded === 0) {
        toast({
          title: "Import failed",
          description: `All ${result.failed} participant${result.failed === 1 ? "" : "s"} failed to import. ${result.errors[0]?.reason || ""}`,
          variant: "destructive",
        });
      } else {
        const duplicateCount = result.errors.filter(e =>
          e.reason.includes("duplicate key") || e.reason.includes("already exists")
        ).length;
        const duplicateEmails = result.errors
          .filter(e => e.reason.includes("duplicate key") || e.reason.includes("already exists"))
          .slice(0, 3)
          .map(e => e.email);

        toast({
          title: "Partial import",
          description: `${result.succeeded} imported, ${result.failed} skipped (${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"}: ${duplicateEmails.join(", ")}${duplicateCount > 3 ? "..." : ""})`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: "Import failed",
        description:
          error instanceof Error
            ? error.message
            : "We could not parse that CSV. Please ensure it includes Pretix ID and Email columns.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            Participant Management
          </h2>
          <p className="text-muted-foreground">
            Keep attendee information up-to-date and ready for assignment.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 bg-transparent"
            onClick={handleImportClick}
          >
            <UploadCloud className="h-4 w-4" />
            Import CSV
          </Button>
          <Button className="gap-2" onClick={() => openDialog("create")}>
            <Plus className="h-4 w-4" />
            Add Participant
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Participants
            </CardTitle>
            <CardDescription>Imported from Pretix</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{participants.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Eligible Participants
            </CardTitle>
            <CardDescription>Registered & late joiners</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-success">
              {totalRegistered}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Captains Ready
            </CardTitle>
            <CardDescription>Available table captains</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalCaptains}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assignments</CardTitle>
            <CardDescription>Participants currently placed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {Object.keys(assignmentByParticipant).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter by status or captain availability.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative md:max-w-xs">
              <Input
                placeholder="Search by name, email, or Pretix ID…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pr-9"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-0.5 h-8 w-8"
                  onClick={() => setSearchTerm("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value: StatusFilter) => setStatusFilter(value)}
            >
              <SelectTrigger className="md:max-w-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="late_joiner">Late joiner</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={captainFilter}
              onValueChange={(value: CaptainFilter) => setCaptainFilter(value)}
            >
              <SelectTrigger className="md:max-w-xs">
                <SelectValue placeholder="Captain filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Captains & attendees</SelectItem>
                <SelectItem value="captain">Captains only</SelectItem>
                <SelectItem value="attendee">Attendees only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participants ({filteredParticipants.length})</CardTitle>
          <CardDescription>
            Update attendee data or remove cancellations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : filteredParticipants.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No participants match the current filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Pretix ID</TableHead>
                  <TableHead>Captain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned Restaurant</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipants.map((participant) => {
                  const assignmentRestaurantId =
                    assignmentByParticipant[participant.id];
                  const assignedRestaurant = assignmentRestaurantId
                    ? restaurantById.get(assignmentRestaurantId)
                    : undefined;

                  return (
                    <TableRow key={participant.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {participant.attendee_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {participant.given_name} {participant.family_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">
                          {participant.attendee_email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {participant.pretix_id}
                        </span>
                      </TableCell>
                      <TableCell>
                        {participant.is_table_captain ? (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary"
                          >
                            Captain
                          </Badge>
                        ) : (
                          <Badge variant="outline">Attendee</Badge>
                        )}
                        {participant.captain_phone && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {participant.captain_phone}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "px-2 py-1 text-xs",
                            statusBadgeStyles[participant.status]
                          )}
                        >
                          {participant.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {assignedRestaurant ? (
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">
                              {assignedRestaurant.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {assignedRestaurant.address}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {participant.status === "cancelled" ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(participant.id)}
                              title="Reactivate participant"
                            >
                              <UserCheck className="h-4 w-4 text-success" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(participant.id)}
                              title="Cancel participant"
                            >
                              <UserX className="h-4 w-4 text-warning" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDialog("edit", participant.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove participant?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  They will be removed from assignments and
                                  lists. Continue?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(participant.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogState.open}
        onOpenChange={(open) =>
          open ? setDialogState((state) => ({ ...state, open })) : closeDialog()
        }
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === "create"
                ? "Add participant"
                : "Edit participant"}
            </DialogTitle>
            <DialogDescription>
              Manage attendee details used for restaurant assignments.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="pretix_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pretix ID</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="registered">Registered</SelectItem>
                          <SelectItem value="late_joiner">
                            Late joiner
                          </SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="given_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Given name</FormLabel>
                      <FormControl>
                        <Input placeholder="Alice" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="family_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Family name</FormLabel>
                      <FormControl>
                        <Input placeholder="Johnson" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="attendee_name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Badge name</FormLabel>
                      <FormControl>
                        <Input placeholder="Alice Johnson" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="attendee_email"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="alice@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_table_captain"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <FormLabel>Table captain</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Captains can guide their table and receive export
                          summaries.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="captain_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Captain phone</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+49 123 4567"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(event.target.value || undefined)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="captain_preferred_contact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred contact</FormLabel>
                      <Select
                        value={field.value ?? "none"}
                        onValueChange={(value) =>
                          field.onChange(value === "none" ? undefined : value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select channel" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="telegram">Telegram</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createParticipant.isPending || editParticipant.isPending
                  }
                >
                  {dialogState.mode === "create"
                    ? "Add participant"
                    : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
