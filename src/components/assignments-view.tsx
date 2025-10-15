
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Users, UtensilsCrossed } from "lucide-react"

// Mock assignment data
const mockAssignments = [
  {
    personId: 1,
    personName: "Alice Johnson",
    personEmail: "alice@example.com",
    restaurantId: 1,
    restaurantName: "La Bella Vista",
    restaurantAddress: "123 Main St",
  },
  {
    personId: 3,
    personName: "Carol White",
    personEmail: "carol@example.com",
    restaurantId: 2,
    restaurantName: "Sushi Palace",
    restaurantAddress: "456 Oak Ave",
  },
  {
    personId: 4,
    personName: "David Brown",
    personEmail: "david@example.com",
    restaurantId: 3,
    restaurantName: "The Steakhouse",
    restaurantAddress: "789 Elm St",
  },
  {
    personId: 5,
    personName: "Emma Davis",
    personEmail: "emma@example.com",
    restaurantId: 1,
    restaurantName: "La Bella Vista",
    restaurantAddress: "123 Main St",
  },
]

export function AssignmentsView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("people")

  // Group assignments by restaurant
  const restaurantGroups = mockAssignments.reduce(
    (acc, assignment) => {
      if (!acc[assignment.restaurantId]) {
        acc[assignment.restaurantId] = {
          restaurant: {
            id: assignment.restaurantId,
            name: assignment.restaurantName,
            address: assignment.restaurantAddress,
          },
          people: [],
        }
      }
      acc[assignment.restaurantId].people.push({
        id: assignment.personId,
        name: assignment.personName,
        email: assignment.personEmail,
      })
      return acc
    },
    {} as Record<number, { restaurant: any; people: any[] }>,
  )

  // Filter based on search
  const filteredPeopleAssignments = mockAssignments.filter(
    (a) =>
      a.personName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.personEmail.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredRestaurantGroups = Object.values(restaurantGroups).filter(
    (group) =>
      group.restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.restaurant.address.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Assignments</h2>
        <p className="text-muted-foreground">Search for people or restaurants to view assignments</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by person name, email, or restaurant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="people" className="gap-2">
            <Users className="h-4 w-4" />
            By People
          </TabsTrigger>
          <TabsTrigger value="restaurants" className="gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            By Restaurant
          </TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>People Assignments ({filteredPeopleAssignments.length})</CardTitle>
              <CardDescription>Find which restaurant each person is assigned to</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredPeopleAssignments.map((assignment) => (
                  <div
                    key={assignment.personId}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{assignment.personName}</p>
                      <p className="text-sm text-muted-foreground">{assignment.personEmail}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1">
                        <UtensilsCrossed className="mr-1 h-3 w-3" />
                        {assignment.restaurantName}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{assignment.restaurantAddress}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restaurants" className="space-y-4">
          {filteredRestaurantGroups.map((group) => (
            <Card key={group.restaurant.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{group.restaurant.name}</CardTitle>
                    <CardDescription>{group.restaurant.address}</CardDescription>
                  </div>
                  <Badge variant="secondary">{group.people.length} people</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.people.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between rounded-md border border-border bg-secondary/50 p-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{person.name}</p>
                        <p className="text-sm text-muted-foreground">{person.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
