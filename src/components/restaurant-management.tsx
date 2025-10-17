import { useMemo, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Pencil, Trash2 } from "lucide-react"

import { useRestaurants } from "@/hooks/use-restaurants"
import { useParticipants } from "@/hooks/use-participants"
import { useAssignments } from "@/hooks/use-assignments"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
} from "@/components/ui/alert-dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"

const toOptionalNumber = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return null
  }
  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    return value
  }
  return parsed
}

const toOptionalString = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return null
  }
  return String(value)
}

const restaurantSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    address: z.string().min(1, "Address is required"),
    max_seats: z
      .preprocess((value) => Number(value), z.number({ invalid_type_error: "Max seats is required" }).int().min(1))
      .describe("Maximum number of seats"),
    taxi_time: z
      .preprocess(toOptionalNumber, z.number().int().min(0).nullable())
      .describe("Taxi travel time in minutes")
      .optional()
      .default(null),
    public_transport_time: z
      .preprocess(toOptionalNumber, z.number().int().min(0).nullable())
      .describe("Public transport travel time in minutes")
      .optional()
      .default(null),
    public_transport_lines: z.preprocess(toOptionalString, z.string().nullable()).optional().default(null),
    assigned_captain_id: z.preprocess(toOptionalString, z.string().nullable()).optional().default(null),
  })
  .transform((value) => ({
    ...value,
    taxi_time: value.taxi_time ?? null,
    public_transport_time: value.public_transport_time ?? null,
    public_transport_lines: value.public_transport_lines ?? null,
    assigned_captain_id: value.assigned_captain_id ?? null,
  }))

type RestaurantFormValues = z.output<typeof restaurantSchema>

interface RestaurantDialogState {
  open: boolean
  mode: "create" | "edit"
  restaurantId?: string
}

const initialFormValues: RestaurantFormValues = {
  name: "",
  address: "",
  max_seats: 1,
  taxi_time: null,
  public_transport_time: null,
  public_transport_lines: null,
  assigned_captain_id: null,
}

const getOccupancyBadgeStyles = (ratio: number) => {
  if (ratio >= 1) {
    return "bg-destructive text-destructive-foreground"
  }
  if (ratio >= 0.8) {
    return "bg-warning text-warning-foreground"
  }
  return "bg-success text-success-foreground"
}

const formatMinutes = (value: number | null) => {
  if (value === null || value === undefined) {
    return "—"
  }
  return `${value} min`
}

export function RestaurantManagement() {
  const { toast } = useToast()
  const { restaurants, isLoading: restaurantsLoading, createRestaurant, editRestaurant, removeRestaurant } =
    useRestaurants()
  const { participants } = useParticipants()
  const { assignments } = useAssignments()

  const [dialogState, setDialogState] = useState<RestaurantDialogState>({ open: false, mode: "create" })

  const form = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantSchema) as unknown as Resolver<RestaurantFormValues>,
    defaultValues: initialFormValues,
  })

  const restaurantById = useMemo(() => {
    return new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]))
  }, [restaurants])

  const captainById = useMemo(() => {
    return new Map(participants.map((participant) => [participant.id, participant]))
  }, [participants])

  const captainOptions = useMemo(() => participants.filter((participant) => participant.is_table_captain), [participants])

  const occupancyByRestaurant = useMemo(() => {
    return restaurants.reduce<Record<string, number>>((acc, restaurant) => {
      const baseAssignments = assignments.filter((assignment) => assignment.restaurant_id === restaurant.id).length
      const captainBonus = restaurant.assigned_captain_id ? 1 : 0
      acc[restaurant.id] = baseAssignments + captainBonus
      return acc
    }, {})
  }, [restaurants, assignments])

  const totalCapacity = useMemo(() => restaurants.reduce((total, restaurant) => total + restaurant.max_seats, 0), [restaurants])
  const totalAssigned = useMemo(
    () => restaurants.reduce((total, restaurant) => total + (occupancyByRestaurant[restaurant.id] ?? 0), 0),
    [restaurants, occupancyByRestaurant],
  )

  const handleDialogOpen = (mode: RestaurantDialogState["mode"], restaurantId?: string) => {
    if (mode === "edit" && restaurantId) {
      const restaurant = restaurantById.get(restaurantId)
      if (restaurant) {
        form.reset({
          name: restaurant.name,
          address: restaurant.address,
          max_seats: restaurant.max_seats,
          taxi_time: restaurant.taxi_time,
          public_transport_time: restaurant.public_transport_time,
          public_transport_lines: restaurant.public_transport_lines ?? null,
          assigned_captain_id: restaurant.assigned_captain_id ?? null,
        })
      }
    } else {
      form.reset(initialFormValues)
    }
    setDialogState({ open: true, mode, restaurantId })
  }

  const handleDialogClose = () => {
    setDialogState((state) => ({ ...state, open: false }))
  }

  const handleSubmit = async (values: RestaurantFormValues) => {
    try {
      if (dialogState.mode === "create") {
        await createRestaurant.mutateAsync({
          name: values.name,
          address: values.address,
          max_seats: values.max_seats,
          taxi_time: values.taxi_time ?? null,
          public_transport_time: values.public_transport_time ?? null,
          public_transport_lines: values.public_transport_lines ?? null,
          assigned_captain_id: values.assigned_captain_id ?? null,
        })
        toast({
          title: "Restaurant added",
          description: `${values.name} is now available for assignments.`,
        })
      } else if (dialogState.mode === "edit" && dialogState.restaurantId) {
        await editRestaurant.mutateAsync({
          id: dialogState.restaurantId,
          payload: {
            name: values.name,
            address: values.address,
            max_seats: values.max_seats,
            taxi_time: values.taxi_time ?? null,
            public_transport_time: values.public_transport_time ?? null,
            public_transport_lines: values.public_transport_lines ?? null,
            assigned_captain_id: values.assigned_captain_id ?? null,
          },
        })
        toast({
          title: "Restaurant updated",
          description: `${values.name} has been updated.`,
        })
      }
      handleDialogClose()
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to save restaurant",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (restaurantId: string) => {
    const target = restaurantById.get(restaurantId)
    if (!target) return
    try {
      await removeRestaurant.mutateAsync(restaurantId)
      toast({
        title: "Restaurant removed",
        description: `${target.name} has been deleted.`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Unable to delete restaurant",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Restaurant Management</h2>
          <p className="text-muted-foreground">Track capacity and assign table captains.</p>
        </div>
        <Button onClick={() => handleDialogOpen("create")} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Restaurant
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Restaurants</CardTitle>
            <CardDescription>Active locations for this event</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{restaurants.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Capacity</CardTitle>
            <CardDescription>Maximum number of guests</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalCapacity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Assigned Guests</CardTitle>
            <CardDescription>Includes captains</CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn("text-2xl font-semibold", totalAssigned > totalCapacity ? "text-destructive" : undefined)}>
              {totalAssigned}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Restaurants</CardTitle>
          <CardDescription>Manage seating capacity, transport info, and captains.</CardDescription>
        </CardHeader>
        <CardContent>
          {restaurantsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-center">Occupancy</TableHead>
                  <TableHead>Captain</TableHead>
                  <TableHead>Transport</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurants.map((restaurant) => {
                  const occupancy = occupancyByRestaurant[restaurant.id] ?? 0
                  const ratio = restaurant.max_seats ? occupancy / restaurant.max_seats : 0
                  const captain = restaurant.assigned_captain_id
                    ? captainById.get(restaurant.assigned_captain_id)
                    : undefined

                  return (
                    <TableRow key={restaurant.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{restaurant.name}</div>
                        {restaurant.public_transport_lines && (
                          <p className="text-xs text-muted-foreground">Lines: {restaurant.public_transport_lines}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">{restaurant.address}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={cn("justify-center px-3 py-1", getOccupancyBadgeStyles(ratio))}>
                          {occupancy}/{restaurant.max_seats}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {captain ? (
                          <div className="flex flex-col">
                            <span className="text-sm text-foreground">{captain.attendee_name}</span>
                            <span className="text-xs text-muted-foreground">{captain.attendee_email}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <span>Taxi: {formatMinutes(restaurant.taxi_time)}</span>
                          <span>Transit: {formatMinutes(restaurant.public_transport_time)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleDialogOpen("edit", restaurant.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete restaurant?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove {restaurant.name} and any assignments tied to it. This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(restaurant.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogState.open} onOpenChange={(open) => (open ? setDialogState((state) => ({ ...state, open })) : handleDialogClose())}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialogState.mode === "create" ? "Add restaurant" : "Edit restaurant"}</DialogTitle>
            <DialogDescription>Provide seating capacity and optional transport details.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="The Steakhouse" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="123 Main St, City" rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="max_seats"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max seats</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assigned_captain_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Table captain</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(value) => field.onChange(value === "" ? null : value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Unassigned</SelectItem>
                          {captainOptions.map((captain) => (
                            <SelectItem key={captain.id} value={captain.id}>
                              {captain.attendee_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxi_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taxi time (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value === "" ? null : Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="public_transport_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public transport (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value === "" ? null : Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="public_transport_lines"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transit lines</FormLabel>
                      <FormControl>
                        <Input placeholder="U8, Tram 1" value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value || null)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRestaurant.isPending || editRestaurant.isPending}>
                  {dialogState.mode === "create" ? "Add restaurant" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
