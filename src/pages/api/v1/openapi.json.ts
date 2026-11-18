import type { APIRoute } from 'astro';

/**
 * Generates and returns the complete OpenAPI 3.1.0 specification for TripPlanner.
 * Dynamically resolves server URLs and provides strict schemas for all agentic tool calling.
 */
export function generateOpenApiSpec(origin: string = 'http://localhost:4321') {
  return {
    openapi: '3.1.0',
    info: {
      title: 'TripPlanner API',
      version: '1.0.0',
      description:
        'Wanderlog-style collaborative trip planning API with daily route optimization, expense splitting, reservation tracking, multi-format export, and ChatGPT action integrations.',
      contact: {
        name: 'TripPlanner Support',
        email: 'support@tripplanner.dev',
      },
    },
    servers: [
      {
        url: origin,
        description: 'Active TripPlanner Server',
      },
    ],
    paths: {
      '/api/v1/trips': {
        get: {
          operationId: 'listTrips',
          summary: 'List trips',
          description: 'Returns all trips with high-level metadata and summary statistics.',
          parameters: [
            {
              name: 'view',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['compact', 'full'], default: 'full' },
              description: 'Projection view: compact for low token count, full for detailed metadata.',
            },
          ],
          responses: {
            '200': {
              description: 'List of trips',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/TripSummary' },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createTrip',
          summary: 'Create a new trip',
          description: 'Creates a new trip and initializes default calendar days and sections.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title', 'destination', 'start_date', 'end_date'],
                  properties: {
                    title: { type: 'string', example: '5-Day Kyoto Autumn Expedition' },
                    destination: { type: 'string', example: 'Kyoto, Japan' },
                    start_date: { type: 'string', format: 'date', example: '2026-11-01' },
                    end_date: { type: 'string', format: 'date', example: '2026-11-05' },
                    timezone: { type: 'string', default: 'UTC', example: 'Asia/Tokyo' },
                    currency: { type: 'string', default: 'USD', example: 'USD' },
                    budget_cap: { type: 'number', nullable: true, example: 2500 },
                    cover_image_url: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Trip created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Trip' },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}': {
        get: {
          operationId: 'getTrip',
          summary: 'Get trip details',
          description: 'Retrieves full details of a specific trip including schedule, collaborators, and notes.',
          parameters: [
            {
              name: 'tripId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'The unique trip ID.',
            },
            {
              name: 'view',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['compact', 'full'], default: 'full' },
            },
          ],
          responses: {
            '200': {
              description: 'Trip details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Trip' },
                },
              },
            },
            '404': {
              description: 'Trip not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/summary': {
        get: {
          operationId: 'getTripSummary',
          summary: 'Get compact trip summary',
          description: 'Returns compact statistics and progress metrics for a trip.',
          parameters: [
            {
              name: 'tripId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Trip summary metrics',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TripSummary' },
                },
              },
            },
            '404': {
              description: 'Trip not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/days/{dayId}': {
        get: {
          operationId: 'getTripDay',
          summary: 'Get a single day itinerary',
          description: 'Retrieves all sections, scheduled stops, places, and transit legs for a single trip day.',
          parameters: [
            {
              name: 'tripId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'dayId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Day schedule with populated sections and stops',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DaySchedule' },
                },
              },
            },
            '404': {
              description: 'Day not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/sections': {
        post: {
          operationId: 'createTripSection',
          summary: 'Create an itinerary section',
          description: 'Creates a new time-of-day section within a day or an unscheduled wishlist container.',
          parameters: [
            {
              name: 'tripId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title'],
                  properties: {
                    day_id: { type: 'string', nullable: true },
                    title: { type: 'string', example: 'Evening Izakaya Tour' },
                    section_type: {
                      type: 'string',
                      enum: ['morning', 'afternoon', 'evening', 'custom', 'wishlist'],
                      default: 'custom',
                    },
                    sort_order: { type: 'integer', default: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Section created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Section' },
                },
              },
            },
          },
        },
      },

      '/api/v1/places/search': {
        get: {
          operationId: 'searchPlaces',
          summary: 'Search places and attractions',
          description: 'Searches cached places or queries the geospatial place provider by keyword and destination.',
          parameters: [
            {
              name: 'query',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Search keyword (e.g. "Fushimi Inari", "ramen").',
            },
            {
              name: 'near',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Destination or city context (e.g. "Kyoto, Japan").',
            },
          ],
          responses: {
            '200': {
              description: 'Matching places',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Place' },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/stops': {
        post: {
          operationId: 'addTripStop',
          summary: 'Add a stop to an itinerary section',
          description: 'Appends or inserts a place as a planned stop within a section.',
          parameters: [
            {
              name: 'tripId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['section_id', 'place_id'],
                  properties: {
                    section_id: { type: 'string' },
                    place_id: { type: 'string' },
                    sort_order: { type: 'integer' },
                    arrival_time: { type: 'string', nullable: true, example: '09:00' },
                    departure_time: { type: 'string', nullable: true, example: '11:00' },
                    duration_minutes: { type: 'integer', nullable: true, example: 120 },
                    user_notes: { type: 'string', nullable: true },
                    budget_amount: { type: 'number', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Stop added',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/StopDetail' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/stops/{stopId}': {
        patch: {
          operationId: 'updateTripStop',
          summary: 'Update itinerary stop',
          description: 'Updates arrival time, departure time, duration, budget, or notes for a stop.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'stopId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    arrival_time: { type: 'string', nullable: true },
                    departure_time: { type: 'string', nullable: true },
                    duration_minutes: { type: 'integer', nullable: true },
                    user_notes: { type: 'string', nullable: true },
                    budget_amount: { type: 'number', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Stop updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/StopDetail' },
                },
              },
            },
          },
        },
        delete: {
          operationId: 'deleteTripStop',
          summary: 'Delete itinerary stop',
          description: 'Removes a stop and recalculates neighboring transit legs.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'stopId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '204': { description: 'Stop deleted' },
          },
        },
      },

      '/api/v1/trips/{tripId}/stops/{stopId}/move': {
        post: {
          operationId: 'moveTripStop',
          summary: 'Move stop across sections or reorder',
          description: 'Transfers a stop to another section or adjusts its position in the schedule.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'stopId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['target_section_id', 'new_sort_order'],
                  properties: {
                    target_section_id: { type: 'string' },
                    new_sort_order: { type: 'integer' },
                    target_index: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Stop moved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/StopDetail' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/stops/{stopId}/vote': {
        post: {
          operationId: 'voteOnTripStop',
          summary: 'Vote on an itinerary or wishlist stop',
          description: 'Records or updates an upvote or downvote from a trip collaborator on a planned or wishlist stop.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'stopId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['vote'],
                  properties: {
                    collaborator_id: { type: 'string', nullable: true },
                    collaborator_name: { type: 'string', nullable: true },
                    vote: {
                      oneOf: [
                        { type: 'integer', enum: [1, -1] },
                        { type: 'string', enum: ['up', 'down'] },
                      ],
                    },
                    comment: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Vote recorded',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      stop_id: { type: 'string' },
                      upvotes: { type: 'integer' },
                      downvotes: { type: 'integer' },
                      net_score: { type: 'integer' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Validation error',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
            '404': {
              description: 'Stop or trip not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/days/{dayId}/optimize': {
        post: {
          operationId: 'optimizeDayRoute',
          summary: 'Optimize daily route order',
          description:
            'Applies 2-opt TSP route optimization to minimize travel distance and transit times across stops in the day.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'dayId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    transit_mode: {
                      type: 'string',
                      enum: ['walking', 'transit', 'driving', 'bicycling'],
                      default: 'walking',
                    },
                    fix_first_stop: { type: 'boolean', default: true },
                    fix_last_stop: { type: 'boolean', default: false },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Optimized day schedule',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DaySchedule' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/days/{dayNumber}/optimize-route': {
        post: {
          operationId: 'optimizeDayRouteByNumber',
          summary: 'Optimize daily route order by day number',
          description:
            'Applies Nearest-Neighbor + 2-opt TSP route optimization to minimize travel distance and transit times for a 1-indexed trip day.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'dayNumber', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    transit_mode: {
                      type: 'string',
                      enum: ['walking', 'transit', 'driving', 'bicycling'],
                      default: 'walking',
                    },
                    fix_first_stop: { type: 'boolean', default: true },
                    fix_last_stop: { type: 'boolean', default: false },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Optimized day schedule and distance/time savings',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DaySchedule' },
                },
              },
            },
            '404': {
              description: 'Trip or day not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/diorama': {
        get: {
          operationId: 'getTripDiorama',
          summary: 'Get 2.5D isometric diorama status or render',
          description:
            'Returns cached diorama render status, normalized waypoints, callouts, and safety metrics for a trip day, or triggers a render when render=true.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            {
              name: 'day',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 1, minimum: 1 },
              description: '1-indexed day number to inspect or render.',
            },
            {
              name: 'render',
              in: 'query',
              required: false,
              schema: { type: 'boolean', default: false },
              description: 'If true, renders the diorama synchronously before returning metadata.',
            },
            {
              name: 'quality',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['draft', 'standard', 'high'], default: 'standard' },
            },
          ],
          responses: {
            '200': {
              description: 'Diorama metadata or current status payload',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DioramaMetadata' },
                },
              },
            },
            '500': {
              description: 'Diorama service error',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
        post: {
          operationId: 'renderTripDiorama',
          summary: 'Render 2.5D isometric diorama via Blender Cycles',
          description:
            'Generates a 2.5D isometric diorama PNG using headless Blender 5.x Cycles Metal GPU rendering with destination archetypes and itinerary waypoints.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    day_number: { type: 'integer', default: 1, minimum: 1 },
                    day: { type: 'integer', minimum: 1 },
                    quality: { type: 'string', enum: ['draft', 'standard', 'high'], default: 'standard' },
                    force: { type: 'boolean', default: true },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Diorama rendered successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/DioramaMetadata' },
                },
              },
            },
            '500': {
              description: 'Diorama render failed',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/reservations': {
        get: {
          operationId: 'listReservations',
          summary: 'List trip reservations',
          description: 'Returns all travel reservations (flights, lodging, activities).',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'List of reservations',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Reservation' },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createReservation',
          summary: 'Create travel reservation',
          description: 'Adds a confirmed flight, hotel, rental car, or activity reservation.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['type', 'title', 'start_time'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['flight', 'lodging', 'rental_car', 'activity', 'restaurant', 'other'],
                    },
                    title: { type: 'string', example: 'ANA Flight NH 123' },
                    confirmation_code: { type: 'string', nullable: true, example: 'NH-78291' },
                    provider: { type: 'string', nullable: true, example: 'All Nippon Airways' },
                    start_time: { type: 'string', format: 'date-time', example: '2026-11-01T08:00:00Z' },
                    end_time: { type: 'string', format: 'date-time', nullable: true },
                    location: { type: 'string', nullable: true },
                    cost: { type: 'number', default: 0 },
                    currency: { type: 'string', default: 'USD' },
                    notes: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Reservation created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Reservation' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/reservations/{reservationId}': {
        patch: {
          operationId: 'updateReservation',
          summary: 'Update a travel reservation',
          description: 'Updates fields on an existing flight, lodging, rental car, or activity reservation.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'reservationId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['flight', 'lodging', 'rental_car', 'activity', 'restaurant', 'other'],
                    },
                    title: { type: 'string' },
                    confirmation_code: { type: 'string', nullable: true },
                    provider: { type: 'string', nullable: true },
                    start_time: { type: 'string', format: 'date-time' },
                    end_time: { type: 'string', format: 'date-time', nullable: true },
                    location: { type: 'string', nullable: true },
                    cost: { type: 'number' },
                    currency: { type: 'string' },
                    notes: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Reservation updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Reservation' },
                },
              },
            },
            '404': {
              description: 'Reservation not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
        delete: {
          operationId: 'deleteReservation',
          summary: 'Delete a travel reservation',
          description: 'Deletes a travel reservation from the trip.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'reservationId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Reservation deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      deleted_reservation_id: { type: 'string' },
                    },
                  },
                },
              },
            },
            '404': {
              description: 'Reservation not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/expenses': {
        get: {
          operationId: 'listExpenses',
          summary: 'List trip expenses',
          description: 'Retrieves all expenses recorded for the trip with split details.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'List of expenses',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Expense' },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createExpense',
          summary: 'Record new expense',
          description: 'Records a payment made by a collaborator and creates split allocations.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['paid_by_collaborator_id', 'title', 'amount', 'date'],
                  properties: {
                    paid_by_collaborator_id: { type: 'string' },
                    title: { type: 'string', example: 'Dinner at Gion Kaiseki' },
                    amount: { type: 'number', example: 120.0 },
                    currency: { type: 'string', default: 'USD' },
                    category: {
                      type: 'string',
                      enum: ['food', 'lodging', 'transport', 'activities', 'shopping', 'other'],
                      default: 'other',
                    },
                    date: { type: 'string', format: 'date', example: '2026-11-03' },
                    split_strategy: {
                      type: 'string',
                      enum: ['equal', 'exact', 'percentage'],
                      default: 'equal',
                    },
                    notes: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Expense created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Expense' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/budget/settlement': {
        get: {
          operationId: 'getBudgetSettlement',
          summary: 'Calculate debt settlement and balances',
          description:
            'Calculates individual paid/owed balances and computes the minimal set of peer-to-peer transfers to settle group debts.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Debt settlement calculation',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BudgetSettlement' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/budget/settle-up': {
        get: {
          operationId: 'settleUpBudget',
          summary: 'Get budget settlement transfers and balances',
          description:
            'Computes individual collaborator net balances and minimal Splitwise-style debt settlement transfers.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Debt settlement calculation',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BudgetSettlement' },
                },
              },
            },
            '404': {
              description: 'Trip not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/checklists/{checklistId}/items': {
        post: {
          operationId: 'addChecklistItem',
          summary: 'Add checklist item',
          description: 'Adds an item to a packing list or to-do checklist.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'checklistId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['title'],
                  properties: {
                    title: { type: 'string', example: 'Passport and Visa' },
                    assigned_to_collaborator_id: { type: 'string', nullable: true },
                    due_date: { type: 'string', format: 'date', nullable: true },
                    sort_order: { type: 'integer', default: 0 },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Checklist item added',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ChecklistItem' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/export/markdown': {
        get: {
          operationId: 'exportItineraryMarkdown',
          summary: 'Export trip as Markdown',
          description: 'Generates a complete, beautiful Wanderlog-style Markdown trip guide.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Markdown formatted trip itinerary guide',
              content: {
                'text/markdown': {
                  schema: { type: 'string' },
                },
              },
            },
            '404': {
              description: 'Trip not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/export/ics': {
        get: {
          operationId: 'exportItineraryIcs',
          summary: 'Export trip as iCalendar (.ics)',
          description:
            'Generates a standards-compliant RFC 5545 iCalendar feed for syncing stops and reservations into Apple Calendar, Google Calendar, or Outlook.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'RFC 5545 iCalendar feed',
              content: {
                'text/calendar': {
                  schema: { type: 'string' },
                },
              },
            },
            '404': {
              description: 'Trip not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/trips/{tripId}/export/expenses.csv': {
        get: {
          operationId: 'exportExpensesCsv',
          summary: 'Export expenses as CSV',
          description:
            'Generates a clean CSV report of all trip expenses with categories, amounts, exchange details, and payers.',
          parameters: [
            { name: 'tripId', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'CSV expense report',
              content: {
                'text/csv': {
                  schema: { type: 'string' },
                },
              },
            },
            '404': {
              description: 'Trip not found',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/chat': {
        post: {
          operationId: 'sendChatMessage',
          summary: 'Send message to TripPlanner AI chat agent',
          description:
            'Conversational travel assistant that can plan itineraries, suggest places, answer budget questions, and update trip data.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: {
                    trip_id: { type: 'string', nullable: true },
                    message: { type: 'string', example: 'What should we do on Day 3 afternoon in Kyoto?' },
                    conversation_history: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          role: { type: 'string', enum: ['user', 'assistant'] },
                          content: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Chat agent response with optional tool action results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      reply: { type: 'string' },
                      actions_taken: {
                        type: 'array',
                        items: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      '/api/v1/session': {
        get: {
          operationId: 'getSessionContext',
          summary: 'Get live workspace session state',
          description:
            'Retrieves the synchronized UI session state including active_trip_id, active_day_number, active_tab, selected_stop_id, recent events, and optionally the populated active trip data.',
          parameters: [
            {
              name: 'session_id',
              in: 'query',
              required: false,
              schema: { type: 'string', default: 'default' },
              description: 'Workspace session identifier.',
            },
            {
              name: 'include_trip',
              in: 'query',
              required: false,
              schema: { type: 'boolean', default: true },
              description: 'Whether to embed the full active trip, expenses, and settlement payload.',
            },
          ],
          responses: {
            '200': {
              description: 'Current live workspace session state',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SessionStateResult' },
                },
              },
            },
            '500': {
              description: 'Session retrieve error',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
        post: {
          operationId: 'updateSessionState',
          summary: 'Update live workspace session state',
          description:
            'Updates active trip, day, tab, or selected stop and increments state_version for bi-directional synchronization between the Web UI and Antigravity (agy).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    session_id: { type: 'string', default: 'default' },
                    ui_action: {
                      type: 'string',
                      enum: ['select_trip', 'select_day', 'select_tab', 'select_stop'],
                      description: 'Optional UI quick-mutation action shortcut.',
                    },
                    active_trip_id: { type: 'string' },
                    trip_id: { type: 'string' },
                    active_day_number: { type: 'integer', nullable: true },
                    day_number: { type: 'integer', nullable: true },
                    active_tab: {
                      type: 'string',
                      enum: ['itinerary', 'wishlist', 'bookings', 'budget', 'checklists', 'notes'],
                    },
                    tab: { type: 'string' },
                    selected_stop_id: { type: 'string', nullable: true },
                    stop_id: { type: 'string', nullable: true },
                    actor: { type: 'string', enum: ['ui', 'agy', 'chat', 'system'], default: 'ui' },
                    event_summary: { type: 'string' },
                    summary: { type: 'string' },
                    action: { type: 'string' },
                    ui_context: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated session state',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SessionStateResult' },
                },
              },
            },
            '400': {
              description: 'Invalid request body',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/events': {
        get: {
          operationId: 'streamSessionEvents',
          summary: 'Stream or poll real-time workspace session events',
          description:
            'Real-time synchronization endpoint supporting Server-Sent Events (SSE via Accept: text/event-stream or ?stream=true) and JSON version-delta polling.',
          parameters: [
            {
              name: 'session_id',
              in: 'query',
              required: false,
              schema: { type: 'string', default: 'default' },
            },
            {
              name: 'stream',
              in: 'query',
              required: false,
              schema: { type: 'boolean', default: false },
              description: 'Set true to force text/event-stream SSE output.',
            },
            {
              name: 'since_version',
              in: 'query',
              required: false,
              schema: { type: 'integer', default: 0 },
              description: 'Last known state_version when using JSON delta polling.',
            },
            {
              name: 'include_trip',
              in: 'query',
              required: false,
              schema: { type: 'boolean', default: true },
            },
          ],
          responses: {
            '200': {
              description: 'SSE stream of session_state and version events, or JSON delta payload',
              content: {
                'text/event-stream': {
                  schema: {
                    type: 'string',
                    description: 'Server-Sent Events stream emitting event: session_state and event: version frames.',
                  },
                },
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      has_changes: { type: 'boolean' },
                      current_version: { type: 'integer' },
                      session: { $ref: '#/components/schemas/WorkspaceSession' },
                      events: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/SessionEvent' },
                      },
                      active_trip: { type: 'object', nullable: true },
                    },
                  },
                },
              },
            },
            '500': {
              description: 'Events synchronization error',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
        post: {
          operationId: 'recordSessionEvent',
          summary: 'Record a session mutation event',
          description: 'Records an explicit session mutation event from the UI, chat agent, or Antigravity CLI.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['action'],
                  properties: {
                    session_id: { type: 'string', default: 'default' },
                    trip_id: { type: 'string' },
                    actor: { type: 'string', enum: ['ui', 'agy', 'chat', 'system'], default: 'agy' },
                    action: { type: 'string' },
                    summary: { type: 'string' },
                    active_day_number: { type: 'integer', nullable: true },
                    active_tab: { type: 'string' },
                    selected_stop_id: { type: 'string', nullable: true },
                    payload: { type: 'object' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Session mutation recorded',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      event: { $ref: '#/components/schemas/SessionEvent' },
                      session: { $ref: '#/components/schemas/WorkspaceSession' },
                      state: { $ref: '#/components/schemas/SessionStateResult' },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Missing action or invalid JSON',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetails' },
                },
              },
            },
          },
        },
      },

      '/api/v1/mcp': {
        get: {
          operationId: 'getMcpServerInfo',
          summary: 'Discover TripPlanner MCP server capabilities',
          description:
            'Returns Model Context Protocol (MCP) server discovery metadata, supported transports, registered tools, resources, and Antigravity (agy) configuration instructions.',
          responses: {
            '200': {
              description: 'MCP server discovery metadata',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/McpServerInfo' },
                },
              },
            },
          },
        },
        post: {
          operationId: 'handleMcpRpc',
          summary: 'Execute MCP JSON-RPC 2.0 request',
          description:
            'Streamable HTTP Model Context Protocol (MCP) JSON-RPC 2.0 endpoint supporting single or batch requests (initialize, tools/list, tools/call, resources/list, resources/read).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { $ref: '#/components/schemas/McpRpcRequest' },
                    {
                      type: 'array',
                      items: { $ref: '#/components/schemas/McpRpcRequest' },
                    },
                  ],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'JSON-RPC 2.0 response or batch response array',
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      { $ref: '#/components/schemas/McpRpcResponse' },
                      {
                        type: 'array',
                        items: { $ref: '#/components/schemas/McpRpcResponse' },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },

    components: {
      schemas: {
        Trip: {
          type: 'object',
          required: ['id', 'title', 'destination', 'start_date', 'end_date', 'timezone', 'currency'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            destination: { type: 'string' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            timezone: { type: 'string' },
            currency: { type: 'string' },
            budget_cap: { type: 'number', nullable: true },
            cover_image_url: { type: 'string', nullable: true },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
          },
        },
        TripSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            destination: { type: 'string' },
            start_date: { type: 'string', format: 'date' },
            end_date: { type: 'string', format: 'date' },
            timezone: { type: 'string' },
            currency: { type: 'string' },
            budget_cap: { type: 'number', nullable: true },
            cover_image_url: { type: 'string', nullable: true },
            collaborator_count: { type: 'integer' },
            day_count: { type: 'integer' },
            stop_count: { type: 'integer' },
            total_expenses: { type: 'number' },
          },
        },
        DaySchedule: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            trip_id: { type: 'string' },
            day_number: { type: 'integer' },
            date: { type: 'string', format: 'date' },
            notes: { type: 'string', nullable: true },
            sections: {
              type: 'array',
              items: { $ref: '#/components/schemas/SectionSchedule' },
            },
          },
        },
        Section: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            trip_id: { type: 'string' },
            day_id: { type: 'string', nullable: true },
            title: { type: 'string' },
            section_type: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'custom', 'wishlist'] },
            sort_order: { type: 'integer' },
          },
        },
        SectionSchedule: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            trip_id: { type: 'string' },
            day_id: { type: 'string', nullable: true },
            title: { type: 'string' },
            section_type: { type: 'string' },
            sort_order: { type: 'integer' },
            stops: {
              type: 'array',
              items: { $ref: '#/components/schemas/StopDetail' },
            },
          },
        },
        Place: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            formatted_address: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            category: { type: 'string' },
            rating: { type: 'number', nullable: true },
            google_place_id: { type: 'string', nullable: true },
            website: { type: 'string', nullable: true },
            phone_number: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
          },
        },
        StopDetail: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            section_id: { type: 'string' },
            place_id: { type: 'string' },
            sort_order: { type: 'integer' },
            arrival_time: { type: 'string', nullable: true },
            departure_time: { type: 'string', nullable: true },
            duration_minutes: { type: 'integer', nullable: true },
            user_notes: { type: 'string', nullable: true },
            budget_amount: { type: 'number', nullable: true },
            place: { $ref: '#/components/schemas/Place' },
          },
        },
        Reservation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            trip_id: { type: 'string' },
            type: { type: 'string' },
            title: { type: 'string' },
            confirmation_code: { type: 'string', nullable: true },
            provider: { type: 'string', nullable: true },
            start_time: { type: 'string' },
            end_time: { type: 'string', nullable: true },
            location: { type: 'string', nullable: true },
            cost: { type: 'number' },
            currency: { type: 'string' },
            notes: { type: 'string', nullable: true },
          },
        },
        Expense: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            trip_id: { type: 'string' },
            paid_by_collaborator_id: { type: 'string' },
            title: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            category: { type: 'string' },
            date: { type: 'string' },
            split_strategy: { type: 'string' },
            notes: { type: 'string', nullable: true },
          },
        },
        BudgetSettlement: {
          type: 'object',
          properties: {
            trip_id: { type: 'string' },
            currency: { type: 'string' },
            total_expenses: { type: 'number' },
            balances: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  collaborator_id: { type: 'string' },
                  collaborator_name: { type: 'string' },
                  paid: { type: 'number' },
                  owed: { type: 'number' },
                  net_balance: { type: 'number' },
                },
              },
            },
            settlement_transfers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  from_collaborator_id: { type: 'string' },
                  from_collaborator_name: { type: 'string' },
                  to_collaborator_id: { type: 'string' },
                  to_collaborator_name: { type: 'string' },
                  amount: { type: 'number' },
                  currency: { type: 'string' },
                },
              },
            },
          },
        },
        ChecklistItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            checklist_id: { type: 'string' },
            title: { type: 'string' },
            is_completed: { type: 'boolean' },
            assigned_to_collaborator_id: { type: 'string', nullable: true },
            due_date: { type: 'string', nullable: true },
            sort_order: { type: 'integer' },
          },
        },
        ProblemDetails: {
          type: 'object',
          required: ['type', 'title', 'status', 'detail'],
          properties: {
            type: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'integer' },
            detail: { type: 'string' },
            instance: { type: 'string' },
            code: { type: 'string' },
            suggested_alternatives: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        WorkspaceSession: {
          type: 'object',
          required: ['session_id', 'active_trip_id', 'active_tab', 'last_actor', 'state_version', 'updated_at'],
          properties: {
            session_id: { type: 'string' },
            active_trip_id: { type: 'string' },
            active_day_number: { type: 'integer', nullable: true },
            active_tab: { type: 'string' },
            selected_stop_id: { type: 'string', nullable: true },
            selected_stop: { $ref: '#/components/schemas/StopDetail', nullable: true },
            last_actor: { type: 'string', enum: ['ui', 'agy', 'chat', 'system'] },
            last_event_summary: { type: 'string' },
            state_version: { type: 'integer' },
            ui_context: { type: 'object' },
            updated_at: { type: 'string' },
          },
        },
        SessionEvent: {
          type: 'object',
          required: ['id', 'session_id', 'actor', 'action', 'summary', 'state_version', 'created_at'],
          properties: {
            id: { type: 'string' },
            session_id: { type: 'string' },
            trip_id: { type: 'string', nullable: true },
            actor: { type: 'string', enum: ['ui', 'agy', 'chat', 'system'] },
            action: { type: 'string' },
            summary: { type: 'string' },
            state_version: { type: 'integer' },
            payload: { type: 'object' },
            created_at: { type: 'string' },
          },
        },
        SessionStateResult: {
          type: 'object',
          required: ['session', 'recent_events'],
          properties: {
            session: { $ref: '#/components/schemas/WorkspaceSession' },
            recent_events: {
              type: 'array',
              items: { $ref: '#/components/schemas/SessionEvent' },
            },
            selected_stop: { $ref: '#/components/schemas/StopDetail', nullable: true },
            trip: { type: 'object', nullable: true },
          },
        },
        DioramaWaypoint: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
            arrival_time: { type: 'string' },
            category: { type: 'string' },
          },
        },
        DioramaCallout: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            tag: { type: 'string' },
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
          },
        },
        DioramaMetadata: {
          type: 'object',
          properties: {
            tripId: { type: 'string' },
            dayNumber: { type: 'integer' },
            region: { type: 'string' },
            exists: { type: 'boolean' },
            imageUrl: { type: 'string' },
            filePath: { type: 'string' },
            width: { type: 'integer' },
            height: { type: 'integer' },
            samples: { type: 'integer' },
            metrics: { type: 'string' },
            filterLabels: {
              type: 'array',
              items: { type: 'string' },
            },
            waypointsCount: { type: 'integer' },
            waypoints: {
              type: 'array',
              items: { $ref: '#/components/schemas/DioramaWaypoint' },
            },
            callouts: {
              type: 'array',
              items: { $ref: '#/components/schemas/DioramaCallout' },
            },
            generatedAt: { type: 'string' },
            cached: { type: 'boolean' },
          },
        },
        McpServerInfo: {
          type: 'object',
          required: ['name', 'version', 'protocolVersion', 'transports', 'endpoint', 'tools', 'resources'],
          properties: {
            name: { type: 'string', example: 'tripplanner-mcp' },
            version: { type: 'string', example: '1.0.0' },
            protocolVersion: { type: 'string', example: '2025-03-26' },
            transports: {
              type: 'array',
              items: { type: 'string' },
            },
            endpoint: { type: 'string', example: '/api/v1/mcp' },
            stdio_bridge: { type: 'string', example: 'scripts/agy-mcp-server.mjs' },
            capabilities: { type: 'object' },
            tools: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  inputSchema: { type: 'object' },
                },
              },
            },
            resources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  uri: { type: 'string' },
                  name: { type: 'string' },
                  mimeType: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            agy_instructions: { type: 'object' },
          },
        },
        McpRpcRequest: {
          type: 'object',
          required: ['jsonrpc', 'method'],
          properties: {
            jsonrpc: { type: 'string', enum: ['2.0'], default: '2.0' },
            id: {
              oneOf: [{ type: 'string' }, { type: 'integer' }, { type: 'null' }],
            },
            method: {
              type: 'string',
              example: 'tools/call',
            },
            params: { type: 'object' },
          },
        },
        McpRpcResponse: {
          type: 'object',
          required: ['jsonrpc', 'id'],
          properties: {
            jsonrpc: { type: 'string', enum: ['2.0'] },
            id: {
              oneOf: [{ type: 'string' }, { type: 'integer' }, { type: 'null' }],
            },
            result: { type: 'object' },
            error: {
              type: 'object',
              properties: {
                code: { type: 'integer' },
                message: { type: 'string' },
                data: {},
              },
            },
          },
        },
      },
    },
  };
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const spec = generateOpenApiSpec(url.origin);

  return new Response(JSON.stringify(spec, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
