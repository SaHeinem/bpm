import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Shuffle, Users, ClipboardList, AlertTriangle, FileDown, Lock } from "lucide-react"

import { useParticipants } from "@/hooks/use-participants"
import { useRestaurants } from "@/hooks/use-restaurants"
import { useAssignments } from "@/hooks/use-assignments"
import { useEventStatus } from "@/hooks/use-event-status"
import { useToast } from "@/hooks/use-toast"
import { useActivityLogger } from "@/hooks/use-activity-log"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import {
  buildRestaurantRosters,
  generateAssignmentCsv,
  planCaptainAssignments,
  planParticipantAssignments,
  buildRosterPrintHtml,
} from "@/lib/assignment-utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { ShuffleWarningDialog } from "@/components/shuffle-warning-dialog"

const WORKFLOW_LABELS: Record<string, string> = {
  setup: "Setup",
  captains_assigned: "Captains Assigned",
  participants_assigned: "Participants Assigned",
  finalized: "Finalized",
}

export function DashboardOverview() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const activityLogger = useActivityLogger()
  const { participants } = useParticipants()
  const { restaurants } = useRestaurants()
  const { assignments } = useAssignments()
  const { eventStatus, setEventStatusMutation } = useEventStatus()

  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [isAssigningCaptains, setIsAssigningCaptains] = useState(false)
  const [isAssigningParticipants, setIsAssigningParticipants] = useState(false)
  const [isClearingAssignments, setIsClearingAssignments] = useState(false)
  const [isFinalizing, setIsFinalizing] = useState(false)

  const participantById = useMemo(() => new Map(participants.map((participant) => [participant.id, participant])), [participants])

  const assignableParticipants = useMemo(
    () =>
      participants.filter((participant) => participant.status === "registered" || participant.status === "late_joiner"),
    [participants],
  )

  const nonCaptainParticipants = useMemo(
    () => assignableParticipants.filter((participant) => !participant.is_table_captain),
    [assignableParticipants],
  )

  const activeCaptains = useMemo(
    () => participants.filter((participant) => participant.is_table_captain && participant.status !== "cancelled"),
    [participants],
  )

  const restaurantsWithCaptain = useMemo(
    () => restaurants.filter((restaurant) => Boolean(restaurant.assigned_captain_id)),
    [restaurants],
  )

  const totalCapacity = useMemo(() => restaurants.reduce((total, restaurant) => total + restaurant.max_seats, 0), [restaurants])
  const nonCaptainCapacity = Math.max(totalCapacity - restaurants.length, 0)

  const assignedParticipantsCount = useMemo(() => {
    return assignments.filter((assignment) => {
      const participant = participantById.get(assignment.participant_id)
      return participant && participant.status !== "cancelled"
    }).length
  }, [assignments, participantById])

  const assignedNonCaptains = useMemo(() => {
    return assignments.filter((assignment) => {
      const participant = participantById.get(assignment.participant_id)
      return participant && participant.status !== "cancelled" && !participant.is_table_captain
    }).length
  }, [assignments, participantById])

  const participantsAwaitingAssignment = Math.max(nonCaptainParticipants.length - assignedNonCaptains, 0)
  const capacityShortfall = nonCaptainParticipants.length > nonCaptainCapacity
  const captainShortfall = activeCaptains.length < restaurants.length

  const assignmentProgress = nonCaptainCapacity === 0 ? 0 : Math.min((assignedNonCaptains / nonCaptainCapacity) * 100, 100)
  const captainCoverage = restaurants.length === 0 ? 0 : Math.min((restaurantsWithCaptain.length / restaurants.length) * 100, 100)

  const workflowLabel = WORKFLOW_LABELS[eventStatus.state] ?? "Unknown"
  const isFinalized = eventStatus.state === "finalized"
  const lastUpdatedDisplay =
    eventStatus.updated_at && !eventStatus.updated_at.startsWith("1970-")
      ? new Date(eventStatus.updated_at).toLocaleString()
      : "—"

  const handleAssignCaptains = async () => {
    if (isAssigningCaptains) return
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description: "Captains cannot be reassigned after finalization.",
      })
      return
    }
    if (!restaurants.length) {
      toast({
        title: "No restaurants available",
        description: "Add restaurants before assigning captains.",
        variant: "destructive",
      })
      return
    }
    if (activeCaptains.length < restaurants.length) {
      toast({
        title: "Not enough captains",
        description: `You need ${restaurants.length} captains but only have ${activeCaptains.length}.`,
        variant: "destructive",
      })
      return
    }

    try {
      setIsAssigningCaptains(true)
      const plan = planCaptainAssignments(restaurants, activeCaptains)

      const { error } = await supabase
        .from("restaurants")
        .upsert(
          plan.map(({ restaurantId, captainId }) => ({
            id: restaurantId,
            assigned_captain_id: captainId,
          })),
          { onConflict: "id" },
        )
      if (error) throw error

      await setEventStatusMutation.mutateAsync("captains_assigned")
      await activityLogger.mutateAsync({
        event_type: "captain",
        description: `Assigned ${plan.length} captains`,
        actor: null,
        metadata: {
          restaurantCount: plan.length,
        },
      })

      await queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all })
      toast({
        title: "Captains assigned",
        description: "Each restaurant now has a table captain.",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Failed to assign captains",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAssigningCaptains(false)
    }
  }

  const executeParticipantAssignment = async () => {
    if (isAssigningParticipants) return
    if (!restaurantsWithCaptain.length) {
      toast({
        title: "Assign captains first",
        description: "Participants can only be placed once all restaurants have captains.",
        variant: "destructive",
      })
      return
    }
    if (!nonCaptainParticipants.length) {
      toast({
        title: "No participants to assign",
        description: "Import or mark attendees as registered before assigning.",
      })
      return
    }

    try {
      setIsAssigningParticipants(true)
      const { assignments: plannedAssignments, unassigned } = planParticipantAssignments(restaurants, assignableParticipants)

      const { error: clearError } = await supabase.from("assignments").delete().neq("participant_id", "")
      if (clearError) throw clearError

      if (plannedAssignments.length) {
        const payload = plannedAssignments.map(({ participantId, restaurantId }) => ({
          participant_id: participantId,
          restaurant_id: restaurantId,
          assigned_at: new Date().toISOString(),
        }))
        const { error: insertError } = await supabase.from("assignments").insert(payload)
        if (insertError) throw insertError
      }

      await setEventStatusMutation.mutateAsync("participants_assigned")
      await activityLogger.mutateAsync({
        event_type: "assignment",
        description: `Assigned ${plannedAssignments.length} participants`,
        actor: null,
        metadata: {
          unassignedCount: unassigned.length,
        },
      })

      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all })
      toast({
        title: "Participants assigned",
        description:
          plannedAssignments.length === 0
            ? "No participants could be assigned."
            : unassigned.length
              ? `${plannedAssignments.length} assigned. ${unassigned.length} could not be placed due to capacity.`
              : "All eligible participants have been assigned.",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Assignment failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAssigningParticipants(false)
      setShowReassignDialog(false)
    }
  }

  const handleAssignParticipants = () => {
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description: "Assignments are locked. Unfinalize the event to reshuffle.",
      })
      return
    }
    if (capacityShortfall) {
      toast({
        title: "Capacity exceeded",
        description: "Reduce participants or add restaurants before shuffling.",
        variant: "destructive",
      })
      return
    }
    setShowReassignDialog(true)
  }

  const handleClearAssignments = async () => {
    if (isClearingAssignments) return
    if (!assignments.length) {
      toast({
        title: "Nothing to clear",
        description: "There are no assignments yet.",
      })
      return
    }
    if (isFinalized) {
      toast({
        title: "Event finalized",
        description: "Assignments are locked. Unfinalize the event to clear them.",
      })
      return
    }

    try {
      setIsClearingAssignments(true)
      const { error } = await supabase.from("assignments").delete().neq("participant_id", "")
      if (error) throw error

      const nextState = restaurantsWithCaptain.length ? "captains_assigned" : "setup"
      await setEventStatusMutation.mutateAsync(nextState)
      await activityLogger.mutateAsync({
        event_type: "assignment",
        description: "Cleared all participant assignments",
        actor: null,
        metadata: {
          previousAssignments: assignments.length,
        },
      })

      await queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all })
      toast({
        title: "Assignments cleared",
        description: "All participants are now unassigned.",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to clear assignments",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsClearingAssignments(false)
    }
  }

  const handleExport = async () => {
    if (!assignments.length) {
      toast({
        title: "No assignments yet",
        description: "Assign participants before exporting.",
      })
      return
    }

    const rosters = buildRestaurantRosters(
      restaurants,
      participants,
      assignments.map((assignment) => ({
        participantId: assignment.participant_id,
        restaurantId: assignment.restaurant_id,
      })),
    )

    const csv = generateAssignmentCsv(rosters)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = `blind-peering-assignments-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(downloadUrl)

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(buildRosterPrintHtml(rosters))
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
      }, 300)
    }

    await activityLogger.mutateAsync({
      event_type: "assignment",
      description: "Exported assignment rosters",
      actor: null,
      metadata: {
        restaurantCount: rosters.length,
      },
    })

    toast({
      title: "Export ready",
      description: "CSV downloaded and print preview opened for PDF export.",
    })
  }

  const handleFinalize = async () => {
    if (isFinalizing) return
    if (isFinalized) {
      toast({
        title: "Already finalized",
        description: "The event is already locked.",
      })
      return
    }
    if (assignments.length === 0) {
      toast({
        title: "Assign participants first",
        description: "Finalize after participants have been placed.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsFinalizing(true)
      await setEventStatusMutation.mutateAsync("finalized")
      await activityLogger.mutateAsync({
        event_type: "assignment",
        description: "Event finalized",
        actor: null,
        metadata: {
          assignments: assignments.length,
        },
      })
      toast({
        title: "Event finalized",
        description: "Assignments are now locked.",
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to finalize",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsFinalizing(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Event Dashboard</h2>
          <p className="text-muted-foreground">Monitor readiness across restaurants, captains, and participants.</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          State: {workflowLabel}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Participants</CardTitle>
            <CardDescription>Total imported from Pretix</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{participants.length}</span>
              <Badge variant="outline">{assignableParticipants.length} assignable</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Captains Ready</CardTitle>
            <CardDescription>Active captains vs tables needed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{activeCaptains.length}</span>
              <Badge variant="outline">{restaurants.length} tables</Badge>
            </div>
            <Progress value={captainCoverage} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assignments Progress</CardTitle>
            <CardDescription>Participants placed into restaurants</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{assignedNonCaptains}</span>
              <Badge variant="outline">{nonCaptainCapacity} capacity</Badge>
            </div>
            <Progress value={assignmentProgress} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Restaurants</CardTitle>
            <CardDescription>Capacity including captains</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold">{restaurants.length}</span>
              <Badge variant="outline">{totalCapacity} seats</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {(capacityShortfall || captainShortfall) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Setup requires attention</AlertTitle>
          <AlertDescription>
            {capacityShortfall && (
              <p>
                There are {nonCaptainParticipants.length} assignable participants but only {nonCaptainCapacity} seats for
                attendees. Add more restaurants or reduce registrations.
              </p>
            )}
            {captainShortfall && (
              <p>
                Only {activeCaptains.length} captains available for {restaurants.length} restaurants. Recruit additional captains
                before assigning tables.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Run assignments or export details for captains.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleAssignCaptains}
              disabled={isAssigningCaptains || captainShortfall || isFinalized}
              title={
                captainShortfall
                  ? "You need at least as many captains as restaurants."
                  : isFinalized
                    ? "Assignments are locked."
                    : undefined
              }
            >
              {isAssigningCaptains ? <Spinner className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              Assign all captains
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleAssignParticipants}
              disabled={isAssigningParticipants || isFinalized || capacityShortfall || captainShortfall}
              title={
                capacityShortfall
                  ? "Total capacity is too low for attendees."
                  : captainShortfall
                    ? "Assign captains before shuffling participants."
                    : isFinalized
                      ? "Assignments are locked."
                      : undefined
              }
            >
              {isAssigningParticipants ? <Spinner className="h-4 w-4" /> : <Shuffle className="h-4 w-4" />}
              Assign all participants
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleClearAssignments}
              disabled={isClearingAssignments || !assignments.length || isFinalized}
            >
              {isClearingAssignments ? <Spinner className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
              Clear assignments
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleExport}
              disabled={!assignments.length}
            >
              <FileDown className="h-4 w-4" />
              Export rosters
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 bg-transparent"
              onClick={handleFinalize}
              disabled={isFinalizing || isFinalized}
            >
              {isFinalizing ? <Spinner className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              Finalize event
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status Overview</CardTitle>
            <CardDescription>Track outstanding items before you finalize.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last updated</span>
              <span className="text-sm font-medium text-foreground">{lastUpdatedDisplay}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Workflow state</span>
              <Badge>{workflowLabel}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Restaurants with captains</span>
              <span className="text-sm font-medium text-foreground">
                {restaurantsWithCaptain.length} / {restaurants.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Participants awaiting placement</span>
              <span className="text-sm font-medium text-foreground">{participantsAwaitingAssignment}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total assignments</span>
              <span className="text-sm font-medium text-foreground">{assignedParticipantsCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <ShuffleWarningDialog open={showReassignDialog} onOpenChange={setShowReassignDialog} onConfirm={executeParticipantAssignment} />
    </div>
  )
}
